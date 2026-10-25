"""PDF work that must die with the process.

Run as ``python -u -m pdf_worker <job> <path>``. The module imports nothing
heavier than the standard library until the job function runs, so a child
started this way does not load FastAPI, the embedding model, or Chroma.

The parent reads stdout one JSON line at a time and kills the process when
a read stalls or the budget expires. stderr is inherited, not piped.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import threading
import time

# This file is the child interpreter's entry point. Set the pool size before
# PyMuPDF or RapidOCR import onnxruntime.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

_TEXT_SAMPLE_PAGES = 5
_MAX_EDGE_PX = 1600
_JPEG_QUALITY = 70
_MIN_CHARS_PER_PAGE = 40
_protocol = None


def _bind_protocol_pipe() -> None:
    """JSON lines stay on the original stdout. Everything else goes to stderr.

    PyMuPDF and RapidOCR write to file descriptor 1. That would split a JSON
    line and stall the parent, so descriptor 1 is pointed at stderr first.
    """
    global _protocol
    saved = os.dup(1)
    os.dup2(2, 1)
    sys.stdout = sys.stderr
    _protocol = os.fdopen(saved, "w", encoding="utf-8", buffering=1)


def _rss_mb() -> float:
    """Resident set of this process, in megabytes. -1 when it cannot be read."""
    try:
        with open("/proc/self/status", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024.0
    except OSError:
        pass
    if os.name != "nt":
        return -1.0
    try:
        import ctypes
        from ctypes import wintypes

        class _Counters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = _Counters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.windll.kernel32
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        psapi = ctypes.windll.psapi
        psapi.GetProcessMemoryInfo.argtypes = [
            ctypes.c_void_p, ctypes.POINTER(_Counters), wintypes.DWORD,
        ]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        process = kernel32.GetCurrentProcess()
        if psapi.GetProcessMemoryInfo(process, ctypes.byref(counters), counters.cb):
            return counters.WorkingSetSize / (1024 * 1024)
    except Exception:
        return -1.0
    return -1.0


def _emit(payload: dict) -> None:
    """One JSON line on the protocol pipe. Flush so the parent's stall timer sees it."""
    line = json.dumps(payload, ensure_ascii=False)
    if _protocol is None:
        print(line, flush=True)
        return
    _protocol.write(line + "\n")
    _protocol.flush()


def _emit_error(exc: BaseException) -> None:
    _emit({"kind": "error", "message": f"{type(exc).__name__}: {exc}"})


def _emit_jpeg(kind: str, data: bytes, **fields) -> None:
    _emit({
        "kind": kind,
        "data": base64.b64encode(data).decode("ascii") if data else "",
        **fields,
    })


def _capped_matrix(fitz_mod, width_pt: float, height_pt: float, dpi: int):
    """144 DPI on a normal page. A huge page box is scaled so the long edge is 1600 px."""
    zoom = dpi / 72.0
    long_edge = max(float(width_pt), float(height_pt)) * zoom
    if long_edge > _MAX_EDGE_PX and long_edge > 0:
        zoom *= _MAX_EDGE_PX / long_edge
    return fitz_mod.Matrix(zoom, zoom)


def _release_store(fitz_mod) -> None:
    """Empty MuPDF's decoded-image cache. Dropping the pixmap does not do this."""
    fitz_mod.TOOLS.store_shrink(100)


def _job_extract(file_path: str) -> None:
    import pymupdf as fitz

    doc = fitz.open(file_path)
    try:
        page_count = int(doc.page_count or 0)
        toc_plain = [
            [int(level), str(title or ""), int(page)]
            for level, title, page in (doc.get_toc() or [])
        ]
        cached: list[tuple[str, str]] = []
        sample_chars = 0
        sample_n = min(_TEXT_SAMPLE_PAGES, page_count)
        for i in range(sample_n):
            page = doc.load_page(i)
            text = page.get_text() or ""
            label = (page.get_label() or "").strip()
            cached.append((text, label))
            sample_chars += len(text.strip())
            page = None
            _release_store(fitz)
        has_text = sample_n > 0 and (sample_chars / sample_n) >= _MIN_CHARS_PER_PAGE
        _emit({
            "kind": "meta",
            "page_count": page_count,
            "toc": toc_plain,
            "has_text": has_text,
        })
        if not has_text:
            _emit({"kind": "done"})
            return
        for i in range(page_count):
            if i < len(cached):
                text, label = cached[i]
            else:
                page = doc.load_page(i)
                text = page.get_text() or ""
                label = (page.get_label() or "").strip()
                page = None
            _emit({
                "kind": "page",
                "page_index": i + 1,
                "text": text,
                "label": label,
            })
            _release_store(fitz)
        cached.clear()
        _emit({"kind": "done"})
    except Exception as exc:
        _emit_error(exc)
    finally:
        doc.close()


def _job_pypdf(file_path: str) -> None:
    from pypdf import PdfReader

    try:
        reader = PdfReader(file_path)
        page_count = len(reader.pages)
        _emit({
            "kind": "meta",
            "page_count": page_count,
            "toc": [],
            "has_text": True,
        })
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            _emit({
                "kind": "page",
                "page_index": i + 1,
                "text": text,
                "label": "",
            })
        _emit({"kind": "done"})
    except Exception as exc:
        _emit_error(exc)


def _job_render(file_path: str, payload: dict) -> None:
    import pymupdf as fitz

    pages = payload.get("pages") or []
    dpi = int(payload.get("dpi") or 144)
    doc = fitz.open(file_path)
    try:
        for abs_page in pages:
            page_no = int(abs_page)
            if page_no < 1 or page_no > doc.page_count:
                _emit_jpeg("jpeg", b"", page=page_no)
                continue
            page = doc.load_page(page_no - 1)
            matrix = _capped_matrix(fitz, page.rect.width, page.rect.height, dpi)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            jpeg = pix.tobytes("jpeg", jpg_quality=_JPEG_QUALITY)
            pix = None
            page = None
            _emit_jpeg("jpeg", jpeg, page=page_no)
            jpeg = None
            _release_store(fitz)
        _emit({"kind": "done"})
    except Exception as exc:
        _emit_error(exc)
    finally:
        doc.close()


def _job_crop(file_path: str, payload: dict) -> None:
    import pymupdf as fitz

    boxes = payload.get("boxes") or []
    dpi = int(payload.get("dpi") or 144)
    doc = fitz.open(file_path)
    try:
        for index, box in enumerate(boxes):
            abs_page = int(box["abs_page"])
            if abs_page < 1 or abs_page > doc.page_count:
                _emit_jpeg("crop", b"", index=index)
                continue
            page = doc.load_page(abs_page - 1)
            rect = page.rect
            pad = 0.015
            x0 = max(0.0, min(1.0, min(box["x_min"], box["x_max"]) - pad))
            y0 = max(0.0, min(1.0, min(box["y_min"], box["y_max"]) - pad))
            x1 = max(0.0, min(1.0, max(box["x_min"], box["x_max"]) + pad))
            y1 = max(0.0, min(1.0, max(box["y_min"], box["y_max"]) + pad))
            clip = fitz.Rect(
                rect.x0 + x0 * rect.width,
                rect.y0 + y0 * rect.height,
                rect.x0 + x1 * rect.width,
                rect.y0 + y1 * rect.height,
            )
            matrix = _capped_matrix(fitz, clip.width, clip.height, dpi)
            pix = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
            jpeg = pix.tobytes("jpeg", jpg_quality=_JPEG_QUALITY)
            pix = None
            page = None
            _emit_jpeg("crop", jpeg, index=index)
            jpeg = None
            _release_store(fitz)
        _emit({"kind": "done"})
    except Exception as exc:
        _emit_error(exc)
    finally:
        doc.close()


def _job_ocr(file_path: str, payload: dict) -> None:
    import numpy as np
    import pymupdf as fitz
    from rapidocr import RapidOCR

    pages = payload.get("pages") or []
    dpi = int(payload.get("dpi") or 96)
    engine = RapidOCR()
    doc = fitz.open(file_path)
    try:
        for abs_page in pages:
            page_no = int(abs_page)
            if page_no < 1 or page_no > doc.page_count:
                _emit({"kind": "ocr", "page": page_no, "text": ""})
                continue
            page = doc.load_page(page_no - 1)
            matrix = _capped_matrix(fitz, page.rect.width, page.rect.height, dpi)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )
            if img.shape[-1] == 4:
                img = img[:, :, :3]
            result = engine(img)
            text = _rapidocr_text(result)
            result = None
            img = None
            pix = None
            page = None
            _emit({"kind": "ocr", "page": page_no, "text": text})
            _release_store(fitz)
        _emit({"kind": "done"})
    except Exception as exc:
        _emit_error(exc)
    finally:
        doc.close()


def _rapidocr_text(result) -> str:
    txts = getattr(result, "txts", None)
    if txts is not None:
        try:
            lines = [str(line).strip() for line in list(txts) if str(line).strip()]
        except TypeError:
            lines = []
        if lines:
            return "\n".join(lines)
    payload = result[0] if isinstance(result, (list, tuple)) and result else result
    lines = []
    if isinstance(payload, (list, tuple)):
        for item in payload:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                text = str(item[1]).strip()
                if text:
                    lines.append(text)
    return "\n".join(lines)


def _dispatch(job: str, file_path: str, payload: dict) -> None:
    if job == "extract":
        _job_extract(file_path)
    elif job == "pypdf":
        _job_pypdf(file_path)
    elif job == "render":
        _job_render(file_path, payload)
    elif job == "crop":
        _job_crop(file_path, payload)
    elif job == "ocr":
        _job_ocr(file_path, payload)
    else:
        _emit({"kind": "error", "message": f"unknown job {job}"})


def main() -> int:
    if len(sys.argv) != 3:
        _emit({"kind": "error", "message": "usage: pdf_worker <job> <path>"})
        return 2
    job, file_path = sys.argv[1], sys.argv[2]
    _bind_protocol_pipe()
    # RSS before PyMuPDF or RapidOCR. The parent logs this line.
    _emit({"kind": "ready", "rss_mb": round(_rss_mb(), 1)})
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            raise ValueError("job payload must be a JSON object")
        _dispatch(job, file_path, payload)
    except Exception as exc:
        _emit_error(exc)
        return 1
    return 0


class PdfChild:
    """One ``python -u -m pdf_worker`` process.

    Iterate it to receive decoded JSON objects, one stdout line at a time.
    ``close()`` kills, reaps, and closes the stdout pipe.
    """

    def __init__(
        self,
        job: str,
        file_path: str,
        payload: dict | None = None,
        stall_seconds: float = 15,
        budget_seconds: float = 600,
    ) -> None:
        self.job = job
        self.file_path = file_path
        self.payload = payload or {}
        self.stall_seconds = stall_seconds
        self.budget_seconds = budget_seconds
        self.proc: subprocess.Popen | None = None
        self._gen = None
        self._fail: str | None = None
        self._stop_lock = threading.Lock()

    def __iter__(self):
        return self

    def __next__(self):
        if self._gen is None:
            self._gen = self._iterate()
        return next(self._gen)

    def close(self) -> None:
        self._stop_child()
        gen = self._gen
        if gen is not None:
            try:
                gen.close()
            except ValueError:
                pass

    def _stop_child(self) -> None:
        with self._stop_lock:
            self._stop_child_locked()

    def _stop_child_locked(self) -> None:
        proc = self.proc
        if proc is None:
            return
        if proc.poll() is None:
            try:
                proc.kill()
            except OSError:
                pass
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                proc.kill()
            except OSError:
                pass
            proc.wait()
        if proc.stdout is not None and not proc.stdout.closed:
            try:
                proc.stdout.close()
            except Exception:
                pass
        if proc.stdin is not None and not proc.stdin.closed:
            try:
                proc.stdin.close()
            except Exception:
                pass

    def _widen_pipe(self, proc: subprocess.Popen) -> None:
        """Give one JSON line room to land. The parent still holds only that line."""
        if os.name != "posix" or proc.stdout is None:
            return
        try:
            import fcntl
            fcntl.fcntl(proc.stdout.fileno(), fcntl.F_SETPIPE_SZ, 4 * 1024 * 1024)
        except (AttributeError, OSError):
            pass

    def _iterate(self):
        print(
            f"[PDF CHILD] parent rss_mb={_rss_mb():.1f} job={self.job}",
            flush=True,
        )
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        proc = subprocess.Popen(
            [sys.executable, "-u", "-m", "pdf_worker", self.job, self.file_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=None,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            env=env,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        self.proc = proc
        self._widen_pipe(proc)
        stop = threading.Event()
        phase = {"mode": "read", "since": time.monotonic()}
        deadline = time.monotonic() + self.budget_seconds

        def _watch() -> None:
            while not stop.wait(0.2):
                if proc.poll() is not None:
                    return
                now = time.monotonic()
                if now >= deadline:
                    self._fail = "budget"
                    self._stop_child()
                    return
                if phase["mode"] == "read" and now - phase["since"] >= self.stall_seconds:
                    self._fail = "stall"
                    self._stop_child()
                    return

        watcher = threading.Thread(target=_watch, name="pdf-child-watch", daemon=True)
        watcher.start()
        try:
            assert proc.stdin is not None and proc.stdout is not None
            proc.stdin.write(json.dumps(self.payload))
            proc.stdin.close()
            try:
                for raw in proc.stdout:
                    if self._fail:
                        break
                    phase["mode"] = "work"
                    msg = _decode_line(raw)
                    if msg.get("kind") == "ready":
                        print(
                            f"[PDF CHILD] ready rss_mb={msg.get('rss_mb')} job={self.job}",
                            flush=True,
                        )
                        phase["mode"] = "read"
                        phase["since"] = time.monotonic()
                        continue
                    yield msg
                    phase["mode"] = "read"
                    phase["since"] = time.monotonic()
            except (ValueError, OSError):
                pass
            if self._fail == "stall":
                raise TimeoutError("pdf child stalled")
            if self._fail == "budget":
                raise TimeoutError("pdf extract budget")
        finally:
            stop.set()
            self._stop_child()


def _decode_line(raw: str) -> dict:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as exc:
        return {"kind": "error", "message": f"bad child line: {exc}"}
    if not isinstance(msg, dict):
        return {"kind": "error", "message": "child line was not an object"}
    if msg.get("kind") in {"jpeg", "crop"} and isinstance(msg.get("data"), str):
        msg["data"] = base64.b64decode(msg["data"]) if msg["data"] else b""
    return msg


def collect_child_messages(
    job: str,
    file_path: str,
    payload: dict | None = None,
    stall_seconds: float = 20,
    budget_seconds: float = 60,
) -> list:
    """Read a short job to completion. Used for a few pages, not a whole book."""
    child = PdfChild(job, file_path, payload, stall_seconds, budget_seconds)
    messages: list = []
    try:
        for msg in child:
            messages.append(msg)
            if msg.get("kind") in {"done", "error"}:
                break
    finally:
        child.close()
    return messages


if __name__ == "__main__":
    sys.exit(main())
