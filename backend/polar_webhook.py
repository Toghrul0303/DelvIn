"""Polar subscription webhooks. Verifies the signature, then upserts plan limits."""

import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from polar.v2026_10.webhooks import (
    PolarWebhookError,
    PolarWebhookUnknownTypeError,
    PolarWebhookVerificationError,
    validate_event,
)

router = APIRouter()

PAID_EVENTS = {
    "subscription.created",
    "subscription.updated",
    "subscription.active",
}
CANCELED_EVENT = "subscription.canceled"
REVOKED_EVENT = "subscription.revoked"
HANDLED_EVENTS = PAID_EVENTS | {CANCELED_EVENT, REVOKED_EVENT}

PLAN_LIMITS = {
    "pro": (100, None),
    "premium": (250, None),
    "free": (10, 20),
}


class _SkipEvent(Exception):
    """A verified payload that cannot be applied. Acknowledge it so Polar does not retry."""


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


def _metadata(data) -> dict:
    raw = getattr(data, "metadata", None)
    return raw if isinstance(raw, dict) else {}


def _user_id(data) -> str | None:
    raw = _metadata(data).get("user_id")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    external = getattr(getattr(data, "customer", None), "external_id", None)
    if isinstance(external, str) and external.strip():
        return external.strip()
    return None


def _plan_name(data) -> str | None:
    raw = _metadata(data).get("plan_name")
    if isinstance(raw, str):
        name = raw.strip().lower()
        if name in ("pro", "premium"):
            return name
    product_id = getattr(data, "product_id", None)
    if isinstance(product_id, str) and product_id:
        if product_id == (os.getenv("POLAR_PRO_PRODUCT_ID") or "").strip():
            return "pro"
        if product_id == (os.getenv("POLAR_PREMIUM_PRODUCT_ID") or "").strip():
            return "premium"
    return None


def _subscription_row(user_id: str, plan: str, status: str, polar_id: str | None, period_end: str | None) -> dict:
    vision, text_daily = PLAN_LIMITS[plan]
    return {
        "user_id": user_id,
        "plan": plan,
        "status": status,
        "polar_subscription_id": polar_id,
        "vision_queries_monthly": vision,
        "text_queries_daily": text_daily,
        "current_period_end": period_end,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _upsert(row: dict) -> None:
    _supabase(
        "POST",
        "user_subscriptions?on_conflict=user_id",
        row,
        "resolution=merge-duplicates,return=minimal",
    )


def _mark_canceled(user_id: str, polar_id: str | None, period_end: str | None) -> None:
    """Keep the paid limits already stored and record that the period will end."""
    payload = {
        "status": "canceled",
        "polar_subscription_id": polar_id,
        "current_period_end": period_end,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    raw = _supabase(
        "PATCH",
        f"user_subscriptions?user_id=eq.{user_id}",
        payload,
        "return=representation",
    )
    rows = json.loads(raw.decode("utf-8") or "[]")
    if not rows:
        raise _SkipEvent("canceled subscription has no stored plan")


def apply_subscription(event_type: str, data) -> None:
    user_id = _user_id(data)
    if not user_id:
        raise _SkipEvent("missing user id")
    try:
        uuid.UUID(user_id)
    except ValueError as exc:
        raise _SkipEvent("user id is not a uuid") from exc

    status = str(getattr(data, "status", "") or "").lower()
    plan = _plan_name(data)
    period_end = getattr(data, "current_period_end", None)
    if not isinstance(period_end, str):
        period_end = None
    polar_id = getattr(data, "id", None)
    if not isinstance(polar_id, str) or not polar_id:
        polar_id = None

    if event_type == REVOKED_EVENT:
        _upsert(_subscription_row(user_id, "free", "revoked", polar_id, period_end))
        return

    if event_type == CANCELED_EVENT or status == "canceled":
        if plan in ("pro", "premium"):
            _upsert(_subscription_row(user_id, plan, "canceled", polar_id, period_end))
        else:
            _mark_canceled(user_id, polar_id, period_end)
        return

    if plan not in ("pro", "premium"):
        raise _SkipEvent("missing plan_name")
    _upsert(_subscription_row(user_id, plan, status or "active", polar_id, period_end))


@router.post("/webhook/polar")
async def polar_webhook(request: Request):
    secret = (os.getenv("POLAR_WEBHOOK_SECRET") or "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Polar webhooks are not configured")

    body = await request.body()
    try:
        event = validate_event(body, dict(request.headers), secret)
    except PolarWebhookVerificationError as exc:
        raise HTTPException(status_code=403, detail="Invalid webhook signature") from exc
    except PolarWebhookUnknownTypeError:
        return JSONResponse({"received": True}, status_code=202)
    except PolarWebhookError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event_type = event.type
    if event_type not in HANDLED_EVENTS:
        return JSONResponse({"received": True}, status_code=202)

    try:
        apply_subscription(event_type, event.data)
    except _SkipEvent as exc:
        print(f"[polar] acknowledge {event_type}: {exc}", flush=True)
        return JSONResponse({"received": True}, status_code=202)
    except Exception as exc:
        print(f"[polar] sync failed for {event_type}: {exc}", flush=True)
        raise HTTPException(status_code=500, detail="Failed to sync subscription") from exc

    return JSONResponse({"received": True}, status_code=202)
