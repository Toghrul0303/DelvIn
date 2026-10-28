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


@app.function(
    image=_ocr_image,
    secrets=[_sentry_secret],
    cpu=2.0,
    memory=(4096, 8192),
    timeout=180,
    min_containers=0,
    scaledown_window=120,
)
@modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
def ocr(job: PdfJob):
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        _ndjson(job.job, job.url, job.payload or {}, {"ocr"}),
        media_type="application/x-ndjson",
    )
