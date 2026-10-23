"""PDF work that must die with the process.

This module imports PyMuPDF only at call time. It must not import tools.py,
Docling, or the embedding model: the child would otherwise duplicate the
parent heap inside the same 1GB cgroup.

The parent kills the process (SIGKILL on Linux) when a page stalls or the
job is finished. Killing the process is what returns MuPDF's heap to the OS.
"""

from __future__ import annotations

import time
from queue import Empty
from typing import Callable


_TEXT_SAMPLE_PAGES = 5
_MIN_CHARS_PER_PAGE = 40


def extract_pdf_to_queue(file_path: str, queue) -> None:
    """One open, one page at a time. Sends meta, then pages, then done."""
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
        has_text = sample_n > 0 and (sample_chars / sample_n) >= _MIN_CHARS_PER_PAGE
        queue.put({
            "kind": "meta",
            "page_count": page_count,
            "toc": toc_plain,
            "has_text": has_text,
        })
        if not has_text:
            queue.put({"kind": "done"})
            return
        for i in range(page_count):
            if i < len(cached):
                text, label = cached[i]
            else:
                page = doc.load_page(i)
                text = page.get_text() or ""
                label = (page.get_label() or "").strip()
                page = None
            queue.put({
                "kind": "page",
                "page_index": i + 1,
                "text": text,
                "label": label,
            })
        cached.clear()
        queue.put({"kind": "done"})
    except Exception as exc:
        _put_error(queue, exc)
    finally:
        doc.close()


def extract_pypdf_to_queue(file_path: str, queue) -> None:
    """Second parser. The parent starts this only after the MuPDF process is dead."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(file_path)
        page_count = len(reader.pages)
        queue.put({
            "kind": "meta",
            "page_count": page_count,
            "toc": [],
            "has_text": True,
        })
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            queue.put({
                "kind": "page",
                "page_index": i + 1,
                "text": text,
                "label": "",
            })
        queue.put({"kind": "done"})
    except Exception as exc:
        _put_error(queue, exc)


def render_jpeg_job(file_path: str, pages: list, dpi: int, queue) -> None:
    """Render at most a handful of pages. Used when a question is solved, not at upload."""
    import pymupdf as fitz

    doc = fitz.open(file_path)
    try:
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for abs_page in pages:
            page_no = int(abs_page)
            if page_no < 1 or page_no > doc.page_count:
                queue.put({"kind": "jpeg", "page": page_no, "data": b""})
                continue
            page = doc.load_page(page_no - 1)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            queue.put({"kind": "jpeg", "page": page_no, "data": pix.tobytes("jpeg")})
            pix = None
            page = None
        queue.put({"kind": "done"})
    except Exception as exc:
        _put_error(queue, exc)
    finally:
        doc.close()


def crop_jpeg_job(file_path: str, boxes: list, dpi: int, queue) -> None:
    """Clip 0–1 boxes. `boxes` items are dicts with abs_page and x/y min/max."""
    import pymupdf as fitz

    doc = fitz.open(file_path)
    try:
        zoom = dpi / 72.0
        for index, box in enumerate(boxes):
            abs_page = int(box["abs_page"])
            if abs_page < 1 or abs_page > doc.page_count:
                queue.put({"kind": "crop", "index": index, "data": b""})
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
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
            queue.put({"kind": "crop", "index": index, "data": pix.tobytes("jpeg")})
            pix = None
            page = None
        queue.put({"kind": "done"})
    except Exception as exc:
        _put_error(queue, exc)
    finally:
        doc.close()


def ocr_pages_job(file_path: str, pages: list, dpi: int, queue) -> None:
    """RapidOCR lives in this process only. The parent never keeps the engine."""
    import numpy as np
    import pymupdf as fitz
    from rapidocr import RapidOCR

    engine = RapidOCR()
    doc = fitz.open(file_path)
    try:
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for abs_page in pages:
            page_no = int(abs_page)
            if page_no < 1 or page_no > doc.page_count:
                queue.put({"kind": "ocr", "page": page_no, "text": ""})
                continue
            page = doc.load_page(page_no - 1)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )
            if img.shape[-1] == 4:
                img = img[:, :, :3]
            result = engine(img)
            queue.put({"kind": "ocr", "page": page_no, "text": _rapidocr_text(result)})
            pix = None
            page = None
            img = None
        queue.put({"kind": "done"})
    except Exception as exc:
        _put_error(queue, exc)
    finally:
        doc.close()


def collect_child_messages(
    target: Callable,
    args: tuple,
    stall_seconds: float = 20,
    budget_seconds: float = 60,
) -> list:
    """Run `target(*args, queue)` and return every message, including done/error.

    The process is killed when the job finishes or the stall/budget fires,
    so native allocations do not stay in the parent.
    """
    import multiprocessing

    ctx = multiprocessing.get_context("spawn")
    queue = ctx.Queue(maxsize=4)
    proc = ctx.Process(target=target, args=(*args, queue), daemon=False)
    proc.start()
    messages: list = []
    deadline = time.time() + budget_seconds
    try:
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise TimeoutError("pdf child exceeded its time budget")
            try:
                msg = queue.get(timeout=min(stall_seconds, remaining))
            except Empty as exc:
                raise TimeoutError("pdf child stalled") from exc
            messages.append(msg)
            if msg.get("kind") in {"done", "error"}:
                return messages
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(5)
        try:
            queue.close()
        except Exception:
            pass


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


def _put_error(queue, exc: BaseException) -> None:
    try:
        queue.put({"kind": "error", "message": f"{type(exc).__name__}: {exc}"})
    except Exception:
        pass
