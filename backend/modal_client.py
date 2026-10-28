"""Stream Modal PDF jobs one NDJSON line at a time.

The signed Supabase URL is sent in the request body and is never logged.
"""

from __future__ import annotations

import base64
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

SETUP_SECONDS = 90
FETCH_SECONDS = 90
EXTRACT_STALL_SECONDS = 15
EXTRACT_BUDGET_SECONDS = 600
SHORT_STALL_SECONDS = 20
SHORT_BUDGET_SECONDS = 180
_URL_IN_ERROR = re.compile(r"https?://\S+")


def _url_host(url: str) -> str:
    try:
        return urllib.parse.urlparse(url or "").netloc
    except Exception:
        return ""


def record_pdf_pipeline(**fields) -> None:
    """One structured PDF event. Attributes only: no signed URL or token."""
    attributes: dict[str, str | int | float | bool] = {}
    for key, value in fields.items():
        if isinstance(value, bool):
            attributes[key] = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            attributes[key] = value
        elif value is None or value == "":
            continue
        else:
            attributes[key] = str(value)[:200]
    detail = " ".join(f"{key}={attributes[key]}" for key in attributes)
    print(f"[PDF] pipeline {detail}", flush=True)
    try:
        import sentry_sdk

        if not sentry_sdk.is_initialized():
            return
        status = attributes.get("modal_status")
        sign_status = attributes.get("sign_status")
        failed = (
            isinstance(status, int) and (status == 0 or status >= 400)
        ) or (
            isinstance(sign_status, int) and sign_status >= 400
        ) or attributes.get("signed_url_present") is False
        log = sentry_sdk.logger.error if failed else sentry_sdk.logger.info
        log("PDF pipeline", attributes=attributes)
    except Exception as exc:
        print(f"[PDF] pipeline log failed: {type(exc).__name__}", flush=True)


def _capture_full_http_error(exc: BaseException) -> None:
    """Send the original httpx error to Sentry before chat text drops the URL."""
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    if status is None:
        return
    try:
        import sentry_sdk

        if not sentry_sdk.is_initialized():
            return
        request = getattr(exc, "request", None)
        url = str(getattr(request, "url", "") or "")
        with sentry_sdk.new_scope() as scope:
            scope.set_context("pdf_pipeline", {
                "stage": "modal_post",
                "modal_status": status,
                "modal_host": _url_host(url),
                "request_url": url,
            })
            scope.capture_exception(exc)
    except Exception as capture_exc:
        print(f"[PDF] sentry capture failed: {type(capture_exc).__name__}", flush=True)


def public_modal_error(exc: BaseException) -> str:
    """Exception text safe to show in chat. No signed URL."""
    _capture_full_http_error(exc)
    text = _URL_IN_ERROR.sub("", str(exc))
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 160:
        text = text[:160].rstrip() + "..."
    if text:
        return f"{type(exc).__name__}: {text}"
    return type(exc).__name__


def is_storage_object_key(value: str) -> bool:
    text = (value or "").strip().replace("\\", "/")
    if not text or text.startswith("/") or re.match(r"^[A-Za-z]:/", text):
        return False
    return "/" in text and not os.path.isfile(text)


def sign_document_url(object_key: str, access_token: str, expires_in: int = 900) -> str:
    """15-minute URL for one object. The user JWT stays on Railway."""
    if not is_storage_object_key(object_key):
        raise RuntimeError("PDF path is not a storage object")
    if not (access_token or "").strip():
        raise RuntimeError("Signed-in user is required to read the PDF")
    base = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    api_key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    )
    if not base or not api_key:
        raise RuntimeError("Supabase is not configured for document signing")
    safe = urllib.parse.quote(object_key.replace("\\", "/").lstrip("/"), safe="/")
    request = urllib.request.Request(
        f"{base}/storage/v1/object/sign/documents/{safe}",
        data=json.dumps({"expiresIn": int(expires_in)}).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": api_key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        record_pdf_pipeline(
            stage="sign",
            storage_key=object_key,
            signed_url_present=False,
            sign_status=exc.code,
        )
        raise RuntimeError(f"document sign failed: {exc.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        record_pdf_pipeline(
            stage="sign",
            storage_key=object_key,
            signed_url_present=False,
        )
        raise RuntimeError(f"document sign failed: {type(exc).__name__}") from None
    signed = ""
    if isinstance(body, dict):
        signed = str(body.get("signedURL") or body.get("signedUrl") or "")
    if not signed:
        record_pdf_pipeline(
            stage="sign",
            storage_key=object_key,
            signed_url_present=False,
        )
        raise RuntimeError("document sign failed: empty url")
    if signed.startswith("http://") or signed.startswith("https://"):
        final_url = signed
    else:
        if not signed.startswith("/"):
            signed = "/" + signed
        final_url = f"{base}/storage/v1{signed}"
    record_pdf_pipeline(
        stage="sign",
        storage_key=object_key,
        signed_url_present=True,
        signed_url_host=_url_host(final_url),
    )
    return final_url


def _endpoint(job: str) -> str:
    if job == "ocr":
        url = (os.getenv("MODAL_OCR_URL") or "").strip()
    else:
        url = (os.getenv("MODAL_PARSE_URL") or "").strip()
    if not url:
        raise RuntimeError(f"Modal URL is not set for job {job}")
    return url


def _token_value(name: str) -> str:
    value = (os.getenv(name) or "").strip().strip('"').strip("'")
    if value.lower().startswith("bearer "):
        value = value[7:].strip()
    return value


def _auth_headers() -> dict[str, str]:
    """Headers Modal's proxy checks before the web endpoint runs.

    `requires_proxy_auth=True` accepts either pair, and nothing else:
    Modal-Key / Modal-Secret, or Authorization: Bearer <id>.<secret>.
    Those values are proxy tokens (wk- / ws-). API tokens (ak- / as-)
    are a different credential and the proxy answers 401.
    """
    key = _token_value("MODAL_KEY")
    secret = _token_value("MODAL_SECRET")
    if not key or not secret:
        raise RuntimeError("MODAL_KEY and MODAL_SECRET are required")
    if key.startswith("ak-") or secret.startswith("as-"):
        raise RuntimeError(
            "MODAL_KEY and MODAL_SECRET are API tokens (ak- / as-). "
            "The PDF endpoint requires a proxy token (wk- / ws-). "
            "Create one with `modal workspace proxy-tokens create` "
            "and put that pair in these two variables."
        )
    return {
        "Modal-Key": key,
        "Modal-Secret": secret,
        "Authorization": f"Bearer {key}.{secret}",
    }


def _decode_line(raw: str) -> dict:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as exc:
        return {"kind": "error", "message": f"bad modal line: {exc}"}
    if not isinstance(msg, dict):
        return {"kind": "error", "message": "modal line was not an object"}
    if msg.get("kind") in {"jpeg", "crop"} and isinstance(msg.get("data"), str):
        msg["data"] = base64.b64decode(msg["data"]) if msg["data"] else b""
    return msg


class ModalPdfStream:
    """One Modal NDJSON response.

    Setup waits for the first line. Fetch waits for the signed-URL download
    inside Modal. Later lines use the short stall. Closing the response is
    the cancel.
    """

    def __init__(
        self,
        job: str,
        signed_url: str,
        payload: dict | None = None,
        stall_seconds: float = EXTRACT_STALL_SECONDS,
        budget_seconds: float = EXTRACT_BUDGET_SECONDS,
        setup_seconds: float = SETUP_SECONDS,
        fetch_seconds: float = FETCH_SECONDS,
        storage_key: str = "",
    ) -> None:
        self.job = job
        self.signed_url = signed_url
        self.storage_key = storage_key
        self.payload = payload or {}
        self.stall_seconds = stall_seconds
        self.budget_seconds = budget_seconds
        self.setup_seconds = setup_seconds
        self.fetch_seconds = fetch_seconds
        self._stop = threading.Event()
        self._fail: str | None = None
        self._http_lock = threading.Lock()
        self._response = None
        self._client = None
        self._phase = {"mode": "setup", "since": time.monotonic()}
        self._deadline = time.monotonic() + budget_seconds
        self._gen = None
        self._reader_thread: threading.Thread | None = None

    def __iter__(self):
        return self

    def __next__(self):
        if self._gen is None:
            self._gen = self._iterate()
        return next(self._gen)

    def close(self) -> None:
        self._stop.set()
        self._close_http()
        gen = self._gen
        reader = self._reader_thread
        if gen is None:
            return
        if (
            reader is not None
            and reader.is_alive()
            and threading.current_thread() is not reader
        ):
            return
        try:
            gen.close()
        except (ValueError, RuntimeError):
            pass

    def _close_http(self) -> None:
        with self._http_lock:
            response = self._response
            client = self._client
            self._response = None
            self._client = None
        if response is not None:
            try:
                response.close()
            except Exception:
                pass
        if client is not None:
            try:
                client.close()
            except Exception:
                pass

    def _watch(self) -> None:
        limits = {
            "setup": self.setup_seconds,
            "fetch": self.fetch_seconds,
            "read": self.stall_seconds,
        }
        while not self._stop.wait(0.2):
            now = time.monotonic()
            if now >= self._deadline:
                self._fail = "budget"
                self._close_http()
                return
            mode = self._phase["mode"]
            if mode == "work":
                continue
            limit = limits.get(mode, self.stall_seconds)
            if now - self._phase["since"] >= limit:
                self._fail = "stall"
                self._close_http()
                return

    def _failure_message(self) -> str:
        if self._fail == "stall":
            return "The PDF service stalled before the next page."
        if self._fail == "budget":
            return "The PDF service exceeded its time limit."
        return ""

    def _iterate(self):
        """Block on one line at a time so a textbook is not buffered on Railway.

        Timeouts and HTTP failures become one error object. They are not raised.
        """
        import httpx

        self._reader_thread = threading.current_thread()
        print(f"[PDF] modal stream job={self.job}", flush=True)
        self._deadline = time.monotonic() + self.budget_seconds
        self._phase = {"mode": "setup", "since": time.monotonic()}
        threading.Thread(target=self._watch, name="modal-pdf-watch", daemon=True).start()
        timeout = httpx.Timeout(
            connect=self.setup_seconds,
            read=self.setup_seconds,
            write=60,
            pool=self.setup_seconds,
        )
        body = {"job": self.job, "url": self.signed_url, "payload": self.payload}
        modal_url = _endpoint(self.job)
        posted = False
        try:
            client = httpx.Client(timeout=timeout)
            with self._http_lock:
                self._client = client
            with client.stream(
                "POST",
                modal_url,
                json=body,
                headers=_auth_headers(),
            ) as response:
                with self._http_lock:
                    self._response = response
                response.raise_for_status()
                posted = True
                record_pdf_pipeline(
                    stage="modal_post",
                    storage_key=self.storage_key,
                    signed_url_present=bool(self.signed_url),
                    modal_status=response.status_code,
                    modal_host=_url_host(modal_url),
                    job=self.job,
                )
                for line in response.iter_lines():
                    if self._fail:
                        break
                    if not line:
                        continue
                    msg = _decode_line(line)
                    if msg.get("kind") == "ready":
                        self._phase = {"mode": "fetch", "since": time.monotonic()}
                        continue
                    self._phase = {"mode": "work", "since": time.monotonic()}
                    yield msg
                    self._phase = {"mode": "read", "since": time.monotonic()}
            failed = self._failure_message()
            if failed:
                yield {"kind": "error", "message": failed}
        except Exception as exc:
            if not posted:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                record_pdf_pipeline(
                    stage="modal_post",
                    storage_key=self.storage_key,
                    signed_url_present=bool(self.signed_url),
                    modal_status=status if isinstance(status, int) else 0,
                    modal_host=_url_host(modal_url),
                    job=self.job,
                )
            failed = self._failure_message()
            yield {"kind": "error", "message": failed or public_modal_error(exc)}
        finally:
            self._stop.set()
            self._close_http()


def collect_remote_messages(
    job: str,
    storage_key: str,
    access_token: str,
    payload: dict | None = None,
    stall_seconds: float = SHORT_STALL_SECONDS,
    budget_seconds: float = SHORT_BUDGET_SECONDS,
    setup_seconds: float = SETUP_SECONDS,
    fetch_seconds: float = FETCH_SECONDS,
) -> list:
    """Read a short job to completion. A few pages, not a whole book."""
    signed = sign_document_url(storage_key, access_token)
    stream = ModalPdfStream(
        job,
        signed,
        payload,
        stall_seconds=stall_seconds,
        budget_seconds=budget_seconds,
        setup_seconds=setup_seconds,
        fetch_seconds=fetch_seconds,
        storage_key=storage_key,
    )
    messages: list = []
    try:
        for msg in stream:
            messages.append(msg)
            if msg.get("kind") in {"done", "error"}:
                break
    finally:
        stream.close()
    return messages
