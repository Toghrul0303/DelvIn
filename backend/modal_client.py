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
        raise RuntimeError(f"document sign failed: {exc.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"document sign failed: {type(exc).__name__}") from None
    signed = ""
    if isinstance(body, dict):
        signed = str(body.get("signedURL") or body.get("signedUrl") or "")
    if not signed:
        raise RuntimeError("document sign failed: empty url")
    if signed.startswith("http://") or signed.startswith("https://"):
        return signed
    if not signed.startswith("/"):
        signed = "/" + signed
    print(f"[PDF] signed storage object expires={expires_in}s", flush=True)
    return f"{base}/storage/v1{signed}"


def _endpoint(job: str) -> str:
    if job == "ocr":
        url = (os.getenv("MODAL_OCR_URL") or "").strip()
    else:
        url = (os.getenv("MODAL_PARSE_URL") or "").strip()
    if not url:
        raise RuntimeError(f"Modal URL is not set for job {job}")
    return url


def _auth_headers() -> dict[str, str]:
    key = (os.getenv("MODAL_KEY") or "").strip()
    secret = (os.getenv("MODAL_SECRET") or "").strip()
    if not key or not secret:
        raise RuntimeError("MODAL_KEY and MODAL_SECRET are required")
    return {"Modal-Key": key, "Modal-Secret": secret}


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
    ) -> None:
        self.job = job
        self.signed_url = signed_url
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
        if gen is not None:
            try:
                gen.close()
            except ValueError:
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

    def _raise_if_failed(self) -> None:
        if self._fail == "stall":
            raise TimeoutError("pdf child stalled")
        if self._fail == "budget":
            raise TimeoutError("pdf extract budget")

    def _iterate(self):
        """Block on one line at a time so a textbook is not buffered on Railway."""
        import httpx

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
        try:
            client = httpx.Client(timeout=timeout)
            with self._http_lock:
                self._client = client
            with client.stream(
                "POST",
                _endpoint(self.job),
                json=body,
                headers=_auth_headers(),
            ) as response:
                with self._http_lock:
                    self._response = response
                response.raise_for_status()
                for line in response.iter_lines():
                    self._raise_if_failed()
                    if not line:
                        continue
                    msg = _decode_line(line)
                    if msg.get("kind") == "ready":
                        self._phase = {"mode": "fetch", "since": time.monotonic()}
                        continue
                    self._phase = {"mode": "work", "since": time.monotonic()}
                    yield msg
                    self._phase = {"mode": "read", "since": time.monotonic()}
                self._raise_if_failed()
        except TimeoutError:
            raise
        except Exception as exc:
            self._raise_if_failed()
            raise RuntimeError(f"{type(exc).__name__}: {exc}") from exc
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
