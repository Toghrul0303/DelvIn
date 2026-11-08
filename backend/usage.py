"""Signed-in query caps. One Supabase call resets the window and spends a credit."""

import asyncio
import json
import os
import urllib.error
import urllib.request
import uuid

_vision_metered: set[str] = set()
_vision_locks: dict[str, asyncio.Lock] = {}


class AuthRequired(Exception):
    """Missing or rejected Supabase access token."""


class UsageLimitExceeded(Exception):
    """This turn is not allowed to spend another text or vision credit."""

    def __init__(self, kind: str, plan: str, limit: int | None):
        self.kind = kind if kind in ("text", "vision") else "vision"
        self.plan = plan or "free"
        self.limit = limit
        super().__init__(self.kind)


def _service_env() -> tuple[str, str]:
    url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    return url, key


def _supabase(method: str, path: str, body: dict | None, prefer: str) -> bytes:
    url, key = _service_env()
    if not url or not key:
        raise RuntimeError("Supabase service role is not configured")
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Supabase {method} {path} failed: {exc.code} {detail}") from exc


def _as_limit(value) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def verify_user(access_token: str) -> str:
    """Return the Supabase user id for this access token. Form user ids are not trusted."""
    token = (access_token or "").strip()
    if not token:
        raise AuthRequired()
    url, key = _service_env()
    if not url or not key:
        raise RuntimeError("Supabase service role is not configured")
    request = urllib.request.Request(
        f"{url}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": key,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise AuthRequired() from exc
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Supabase auth user failed: {exc.code} {detail}") from exc
    user_id = payload.get("id") if isinstance(payload, dict) else None
    if not isinstance(user_id, str) or not user_id.strip():
        raise AuthRequired()
    try:
        uuid.UUID(user_id)
    except ValueError as exc:
        raise AuthRequired() from exc
    return user_id


def consume(user_id: str, kind: str) -> dict:
    if kind not in ("text", "vision"):
        raise ValueError(kind)
    raw = _supabase(
        "POST",
        "rpc/consume_quota",
        {"p_user_id": user_id, "p_kind": kind},
        "return=representation",
    )
    payload = json.loads(raw.decode("utf-8") or "{}")
    if not isinstance(payload, dict):
        raise RuntimeError("consume_quota returned an unexpected payload")
    reported = payload.get("kind")
    return {
        "allowed": bool(payload.get("allowed")),
        "kind": reported if reported in ("text", "vision") else kind,
        "plan": str(payload.get("plan") or "free"),
        "limit": _as_limit(payload.get("limit")),
        "used": _as_limit(payload.get("used")) or 0,
    }


def usage_limit_body(result: dict) -> dict:
    kind = result.get("kind")
    return {
        "code": "usage_limit",
        "kind": kind if kind in ("text", "vision") else "text",
        "plan": result.get("plan") or "free",
        "limit": result.get("limit"),
    }


def _configurable(config) -> dict:
    if not isinstance(config, dict):
        return {}
    raw = config.get("configurable")
    return raw if isinstance(raw, dict) else {}


def _request_id(config) -> str:
    return str(_configurable(config).get("request_id") or "")


def note_request_metered(request_id: str) -> None:
    if request_id:
        _vision_metered.add(request_id)


def mark_vision_metered(config) -> None:
    cfg = _configurable(config)
    cfg["vision_metered"] = True
    note_request_metered(_request_id(config))


def vision_is_metered(config) -> bool:
    if _configurable(config).get("vision_metered"):
        return True
    request_id = _request_id(config)
    return bool(request_id and request_id in _vision_metered)


def clear_vision_meter(request_id: str) -> None:
    if not request_id:
        return
    _vision_metered.discard(request_id)
    _vision_locks.pop(request_id, None)


def find_usage_limit(exc: BaseException | None) -> UsageLimitExceeded | None:
    stack: list[BaseException | None] = [exc]
    seen: set[int] = set()
    while stack:
        current = stack.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))
        if isinstance(current, UsageLimitExceeded):
            return current
        stack.append(current.__cause__)
        stack.append(current.__context__)
        grouped = getattr(current, "exceptions", None)
        if isinstance(grouped, tuple):
            stack.extend(grouped)
    return None


async def ensure_vision_quota(config) -> None:
    """Spend one vision credit the first time this turn starts OCR or vision."""
    if vision_is_metered(config):
        return
    user_id = str(_configurable(config).get("quota_user_id") or "")
    if not user_id:
        return
    request_id = _request_id(config) or user_id
    lock = _vision_locks.setdefault(request_id, asyncio.Lock())
    async with lock:
        if vision_is_metered(config):
            return
        result = await asyncio.to_thread(consume, user_id, "vision")
        if not result["allowed"]:
            raise UsageLimitExceeded(result["kind"], result["plan"], result["limit"])
        mark_vision_metered(config)
