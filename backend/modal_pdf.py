"""Modal web functions for PDF parse and OCR.

Deploy from this directory: ``modal deploy modal_pdf.py``.
Railway never imports this module.
"""

from __future__ import annotations

import os
import sys

_BACKEND = os.path.dirname(os.path.abspath(__file__))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

import json
import queue
import tempfile
import threading
import time
import urllib.parse
import urllib.request

import modal
from pydantic import BaseModel

app = modal.App("locknlearn-pdf")
_sentry_secret = modal.Secret.from_name("locknlearn-sentry")

_parse_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("pymupdf", "pypdf", "fastapi[standard]", "sentry-sdk>=2.35.0")
    .add_local_python_source("pdf_worker")
)


def _bake_rapidocr() -> None:
    from rapidocr import RapidOCR

    RapidOCR()


_ocr_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "pymupdf",
        "pypdf",
        "rapidocr",
        "onnxruntime",
        "numpy",
        "fastapi[standard]",
        "sentry-sdk>=2.35.0",
    )
    .run_function(_bake_rapidocr)
    .add_local_python_source("pdf_worker")
)

# The web endpoint only downloads and renders. RapidOCR stays on ocr_page.
_ocr_render_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("pymupdf", "fastapi[standard]", "sentry-sdk>=2.35.0")
    .add_local_python_source("pdf_worker")
)


class PdfJob(BaseModel):
    job: str
    url: str
    payload: dict = {}


def _line(payload: dict) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")


def _ensure_sentry() -> None:
    """Initialize inside the container. Deploy-time import has no DSN."""
    import sentry_sdk

    if sentry_sdk.is_initialized():
        return
    dsn = (os.environ.get("SENTRY_DSN") or "").strip()
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        release=os.environ.get("SENTRY_RELEASE"),
        send_default_pii=False,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        enable_logs=True,
        include_local_variables=False,
        max_request_body_size="never",
    )


def _report_download_error(exc: BaseException, url: str) -> None:
    _ensure_sentry()
    try:
        import sentry_sdk

        if not sentry_sdk.is_initialized():
            return
        parsed = urllib.parse.urlparse(url or "")
        status = getattr(exc, "code", None)
        with sentry_sdk.new_scope() as scope:
            scope.set_context("pdf_pipeline", {
                "stage": "modal_download",
                "signed_url_present": bool(url),
                "signed_url_host": parsed.netloc,
                "modal_status": status if isinstance(status, int) else 0,
            })
            scope.capture_exception(exc)
    except Exception as capture_exc:
        print(f"[PDF] sentry capture failed: {type(capture_exc).__name__}", flush=True)


def _download(url: str) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        with urllib.request.urlopen(url, timeout=90) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        handle.close()
        return handle.name
    except Exception as exc:
        _report_download_error(exc, url)
        handle.close()
        try:
            os.remove(handle.name)
        except OSError:
            pass
        raise


def _run_job(path: str, job: str, payload: dict, hook) -> None:
    import pdf_worker

    if job != "extract":
        pdf_worker._emit_local.hook = hook
        pdf_worker._dispatch(job, path, payload)
        return

    state = {"started": False, "error": None}

    def gated(message: dict) -> None:
        if message.get("kind") == "error" and not state["started"]:
            state["error"] = message
            return
        state["started"] = True
        hook(message)

    pdf_worker._emit_local.hook = gated
    pdf_worker._dispatch("extract", path, payload)
    if state["error"] is not None and not state["started"]:
        pdf_worker._emit_local.hook = hook
        pdf_worker._dispatch("pypdf", path, payload)


def _ndjson(job: str, url: str, payload: dict, allowed: set[str]):
    _ensure_sentry()
    yield _line({"kind": "ready"})
    if job not in allowed:
        yield _line({"kind": "error", "message": f"unknown job {job}"})
        return
    if not url:
        yield _line({"kind": "error", "message": "missing document url"})
        return
    path = ""
    try:
        try:
            path = _download(url)
        except Exception as exc:
            yield _line({
                "kind": "error",
                "message": f"document download failed: {type(exc).__name__}",
            })
            return
        messages: queue.Queue = queue.Queue(maxsize=4)

        def hook(message: dict) -> None:
            messages.put(message)

        def worker() -> None:
            try:
                _run_job(path, job, payload or {}, hook)
            except Exception as exc:
                _ensure_sentry()
                try:
                    import sentry_sdk

                    if sentry_sdk.is_initialized():
                        sentry_sdk.capture_exception(exc)
                except Exception:
                    pass
                messages.put({
                    "kind": "error",
                    "message": f"{type(exc).__name__}: {exc}",
                })
            finally:
                messages.put(None)

        thread = threading.Thread(target=worker, name="modal-pdf-job", daemon=True)
        thread.start()
        while True:
            item = messages.get()
            if item is None:
                break
            yield _line(item)
        thread.join(timeout=5)
    finally:
        if path:
            try:
                os.remove(path)
            except OSError:
                pass


@app.function(
    image=_parse_image,
    secrets=[_sentry_secret],
    cpu=1.0,
    memory=(2048, 4096),
    timeout=700,
    min_containers=1,
    scaledown_window=300,
)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
def parse(job: PdfJob):
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        _ndjson(job.job, job.url, job.payload or {}, {"count", "extract", "pypdf", "render", "crop"}),
        media_type="application/x-ndjson",
    )


_RAPID_ENGINE = None


def _rapid_engine():
    global _RAPID_ENGINE
    if _RAPID_ENGINE is None:
        from rapidocr import RapidOCR

        _RAPID_ENGINE = RapidOCR()
    return _RAPID_ENGINE


def _ocr_jpeg(jpeg: bytes) -> str:
    import numpy as np
    import pymupdf as fitz
    from pdf_worker import _rapidocr_text

    doc = fitz.open(stream=jpeg, filetype="jpeg")
    try:
        pix = doc[0].get_pixmap(alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if img.shape[-1] == 4:
            img = img[:, :, :3]
        img = np.ascontiguousarray(img)
        return _rapidocr_text(_rapid_engine()(img))
    finally:
        doc.close()


_OCR_BATCH = 4
_OCR_PING_SECONDS = 15
_OCR_BUDGET_SECONDS = 170
_STORE_MAX_BYTES = 64 * 1024 * 1024


def _cap_mupdf_store(fitz_mod) -> None:
    """Keep a decoded full-page scan from growing the cache without a bound."""
    try:
        fitz_mod.TOOLS.store_maxsize = _STORE_MAX_BYTES
    except Exception:
        pass


def _render_page_jpeg(doc, fitz_mod, page_no: int, dpi: int) -> bytes:
    from pdf_worker import _JPEG_QUALITY, _capped_matrix, _release_store

    count = int(doc.page_count or 0)
    if page_no < 1 or page_no > count:
        return b""
    page = None
    pix = None
    try:
        page = doc.load_page(page_no - 1)
        matrix = _capped_matrix(fitz_mod, page.rect.width, page.rect.height, dpi)
        try:
            pix = page.get_pixmap(matrix=matrix, alpha=False, annots=False)
        except TypeError:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
        return pix.tobytes("jpeg", jpg_quality=_JPEG_QUALITY)
    finally:
        pix = None
        page = None
        _release_store(fitz_mod)


def _render_ocr_jpegs(path: str, pages: list, dpi: int, messages: queue.Queue, stop: threading.Event) -> list[tuple[int, bytes]]:
    """Render one page at a time. The caller deletes the PDF before OCR starts."""
    import pymupdf as fitz

    _cap_mupdf_store(fitz)
    doc = fitz.open(path)
    rendered: list[tuple[int, bytes]] = []
    try:
        for raw in pages:
            if stop.is_set():
                break
            page_no = int(raw)
            rendered.append((page_no, _render_page_jpeg(doc, fitz, page_no, dpi)))
            messages.put({"kind": "progress"})
        return rendered
    finally:
        doc.close()
        _cap_mupdf_store(fitz)
        from pdf_worker import _release_store
        _release_store(fitz)


def _close_mapper(mapper) -> None:
    """Stop a Modal map. In-flight pages may finish. Unstarted pages are not run."""
    if mapper is None:
        return
    close = getattr(mapper, "close", None)
    if not callable(close):
        return
    try:
        close()
    except Exception:
        pass


def _ocr_stream_message(result) -> dict:
    """A bad page is empty text. Only a dead stream emits kind=error."""
    if isinstance(result, dict) and result.get("kind") == "ocr":
        try:
            page = int(result.get("page") or 0)
        except (TypeError, ValueError):
            page = 0
        return {"kind": "ocr", "page": page, "text": str(result.get("text") or "")}
    page = 0
    if isinstance(result, dict):
        try:
            page = int(result.get("page") or 0)
        except (TypeError, ValueError):
            page = 0
    return {"kind": "ocr", "page": page, "text": ""}


def _capture_ocr_exception(exc: BaseException) -> None:
    _ensure_sentry()
    try:
        import sentry_sdk

        if sentry_sdk.is_initialized():
            sentry_sdk.capture_exception(exc)
    except Exception:
        pass


def _map_ocr_batches(
    rendered: list[tuple[int, bytes]],
    messages: queue.Queue,
    stop: threading.Event,
    mapper_box: dict,
    mapper_lock: threading.Lock,
) -> None:
    """OCR four pages at a time. A slow page does not block the ones behind it."""
    while rendered:
        if stop.is_set():
            return
        batch = rendered[:_OCR_BATCH]
        del rendered[:_OCR_BATCH]
        mapper = ocr_page.map(
            [page_no for page_no, _ in batch],
            [jpeg for _, jpeg in batch],
            order_outputs=False,
            return_exceptions=True,
        )
        with mapper_lock:
            mapper_box["mapper"] = mapper
        try:
            for result in mapper:
                if stop.is_set():
                    return
                messages.put(_ocr_stream_message(result))
        finally:
            _close_mapper(mapper)
            with mapper_lock:
                if mapper_box.get("mapper") is mapper:
                    mapper_box["mapper"] = None
            del batch


def _ndjson_ocr(job: str, url: str, payload: dict):
    """Download once, render the window, then OCR each page on its own container.

    Progress lines keep the Railway fetch timer from treating a cold start as
    a stall. Closing this generator (the HTTP client went away) closes the map.
    """
    _ensure_sentry()
    yield _line({"kind": "ready"})
    if job != "ocr":
        yield _line({"kind": "error", "message": f"unknown job {job}"})
        return
    if not url:
        yield _line({"kind": "error", "message": "missing document url"})
        return
    pages = payload.get("pages") if isinstance(payload, dict) else None
    if not isinstance(pages, list) or not pages:
        yield _line({"kind": "error", "message": "missing pages"})
        return
    try:
        dpi = int((payload or {}).get("dpi") or 96)
    except (TypeError, ValueError):
        dpi = 96
    dpi = min(max(dpi, 36), 150)
    messages: queue.Queue = queue.Queue()
    stop = threading.Event()
    mapper_lock = threading.Lock()
    mapper_box: dict = {"mapper": None}

    def worker() -> None:
        path = ""
        try:
            messages.put({"kind": "progress"})
            try:
                path = _download(url)
            except Exception as exc:
                messages.put({
                    "kind": "error",
                    "message": f"document download failed: {type(exc).__name__}",
                })
                return
            try:
                rendered = _render_ocr_jpegs(path, pages, dpi, messages, stop)
            except Exception as exc:
                _capture_ocr_exception(exc)
                messages.put({"kind": "error", "message": f"{type(exc).__name__}: {exc}"})
                return
            finally:
                if path:
                    try:
                        os.remove(path)
                    except OSError:
                        pass
                    path = ""
            if stop.is_set():
                return
            _map_ocr_batches(rendered, messages, stop, mapper_box, mapper_lock)
            if not stop.is_set():
                messages.put({"kind": "done"})
        except Exception as exc:
            _capture_ocr_exception(exc)
            messages.put({"kind": "error", "message": f"{type(exc).__name__}: {exc}"})
        finally:
            messages.put(None)

    thread = threading.Thread(target=worker, name="modal-ocr-job", daemon=True)
    thread.start()
    deadline = time.monotonic() + _OCR_BUDGET_SECONDS
    try:
        while True:
            if time.monotonic() >= deadline:
                stop.set()
                with mapper_lock:
                    _close_mapper(mapper_box.get("mapper"))
                    mapper_box["mapper"] = None
                yield _line({
                    "kind": "error",
                    "message": "The PDF service exceeded its time limit.",
                })
                return
            try:
                item = messages.get(timeout=_OCR_PING_SECONDS)
            except queue.Empty:
                if not thread.is_alive():
                    yield _line({"kind": "error", "message": "PDF OCR worker stopped"})
                    return
                yield _line({"kind": "progress"})
                continue
            if item is None:
                break
            yield _line(item)
            if item.get("kind") == "error":
                stop.set()
                return
    finally:
        stop.set()
        with mapper_lock:
            _close_mapper(mapper_box.get("mapper"))
            mapper_box["mapper"] = None
        thread.join(timeout=5)


@app.function(
    image=_ocr_image,
    secrets=[_sentry_secret],
    cpu=2.0,
    memory=(2048, 4096),
    timeout=120,
    min_containers=0,
    scaledown_window=60,
)
def ocr_page(page_no: int, jpeg: bytes) -> dict:
    """One rendered page. The parent already downloaded the PDF."""
    try:
        page = int(page_no)
        body = bytes(jpeg or b"")
        if not body:
            return {"kind": "ocr", "page": page, "text": ""}
        return {"kind": "ocr", "page": page, "text": _ocr_jpeg(body)}
    except Exception as exc:
        _ensure_sentry()
        try:
            import sentry_sdk

            if sentry_sdk.is_initialized():
                sentry_sdk.capture_exception(exc)
        except Exception:
            pass
        return {"kind": "error", "page": int(page_no or 0), "message": f"{type(exc).__name__}: {exc}"}


@app.function(
    image=_ocr_render_image,
    secrets=[_sentry_secret],
    cpu=1.0,
    memory=(2048, 4096),
    timeout=180,
    min_containers=0,
    scaledown_window=120,
)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
def ocr(job: PdfJob):
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        _ndjson_ocr(job.job, job.url, job.payload or {}),
        media_type="application/x-ndjson",
    )
