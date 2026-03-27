"""Billing routes for Stripe-ready checkout, portal, status, and webhook handling."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth import has_subscription_access, now_utc, require_user
from app.core.config import settings
from app.core.db import get_db
from app.models.billing import BillingCheckoutOut, BillingPortalOut, BillingStatusOut, BillingWebhookAck
from app.utils.mongo import oid_str

try:  # pragma: no cover - optional dependency until Stripe is installed in the runtime.
    import stripe as stripe_sdk
except Exception:  # pragma: no cover - keep local development and tests working without Stripe installed.
    stripe_sdk = None

router = APIRouter()


def _billing_mode() -> str:
    if settings.stripe_configured and stripe_sdk is not None:
        return "stripe"
    if settings.app_env_normalized == "development":
        return "mock"
    return "unavailable"


def _billing_message() -> str:
    if settings.stripe_configured and stripe_sdk is not None:
        return "Stripe checkout is ready."
    if stripe_sdk is None:
        return "Stripe billing is unavailable until the stripe package is installed on the backend."
    if not settings.stripe_secret_key.strip() and not settings.stripe_price_id.strip():
        return "Stripe billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID."
    if not settings.stripe_secret_key.strip():
        return "Stripe billing is missing STRIPE_SECRET_KEY."
    if not settings.stripe_price_id.strip():
        return "Stripe billing is missing STRIPE_PRICE_ID."
    return "Stripe billing is not ready."


def _user_billing_status(user: dict) -> BillingStatusOut:
    configured = settings.stripe_configured and stripe_sdk is not None
    customer_id = str(user.get("stripe_customer_id") or "").strip() or None
    subscription_status = str(user.get("subscription_status") or "inactive").strip().lower() or "inactive"
    if has_subscription_access(user):
        subscription_status = "active"
    return BillingStatusOut(
        mode=_billing_mode(),
        configured=configured,
        checkout_available=configured,
        portal_available=configured and bool(customer_id),
        dev_fallback_available=settings.app_env_normalized == "development",
        message=_billing_message(),
        subscription_status=subscription_status,
        billing_provider=str(user.get("billing_provider") or "").strip() or None,
        stripe_customer_id=customer_id,
        stripe_subscription_id=str(user.get("stripe_subscription_id") or "").strip() or None,
        stripe_checkout_session_id=str(user.get("stripe_checkout_session_id") or "").strip() or None,
    )


async def _persist_user_billing(user_id: Any, updates: dict) -> dict:
    db = get_db()
    payload = {**updates, "updated_at": now_utc()}
    await db["users"].update_one({"_id": user_id}, {"$set": payload})
    updated = await db["users"].find_one({"_id": user_id})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


def _renewal_from_now(days: int = 30) -> datetime:
    return now_utc() + timedelta(days=days)


async def _create_stripe_checkout(user: dict, success_url: str, cancel_url: str) -> BillingCheckoutOut:
    if not settings.stripe_configured or stripe_sdk is None:
        return BillingCheckoutOut(
            mode=_billing_mode(),
            status="unavailable",
            dev_fallback_available=settings.app_env_normalized == "development",
            subscription_status=str(user.get("subscription_status") or "inactive").strip().lower() or "inactive",
            message=_billing_message(),
        )

    stripe_sdk.api_key = settings.stripe_secret_key.strip()
    customer_id = str(user.get("stripe_customer_id") or "").strip() or None
    if not customer_id:
        customer = stripe_sdk.Customer.create(
            email=user["email"],
            name=user.get("username") or user["email"],
            metadata={"user_id": oid_str(user["_id"])},
        )
        customer_id = customer.id
        user = await _persist_user_billing(user["_id"], {"stripe_customer_id": customer_id, "billing_provider": "stripe"})

    session = stripe_sdk.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_price_id.strip(), "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=oid_str(user["_id"]),
        subscription_data={
            "metadata": {
                "user_id": oid_str(user["_id"]),
                "user_email": user["email"],
            }
        },
        metadata={
            "user_id": oid_str(user["_id"]),
            "user_email": user["email"],
        },
    )
    updated = await _persist_user_billing(
        user["_id"],
        {
            "billing_provider": "stripe",
            "stripe_customer_id": customer_id,
            "stripe_checkout_session_id": session.id,
        },
    )
    return BillingCheckoutOut(
        mode="stripe",
        status="created",
        checkout_url=getattr(session, "url", None),
        session_id=session.id,
        customer_id=customer_id,
        subscription_id=getattr(session, "subscription", None),
        dev_fallback_available=settings.app_env_normalized == "development",
        subscription_status=str(updated.get("subscription_status") or "inactive").strip().lower() or "inactive",
        plan=str(updated.get("subscription_plan") or "").strip() or None,
        renewal_at=updated.get("subscription_renewal_at"),
        message="Checkout session created.",
    )


async def _create_billing_portal(user: dict, return_url: str) -> BillingPortalOut:
    if not settings.stripe_configured or stripe_sdk is None:
        return BillingPortalOut(
            mode=_billing_mode(),
            status="unavailable",
            customer_id=str(user.get("stripe_customer_id") or "").strip() or None,
            message=_billing_message(),
        )

    customer_id = str(user.get("stripe_customer_id") or "").strip() or None
    if not customer_id:
        return BillingPortalOut(
            mode="stripe",
            status="unavailable",
            message="Billing portal is not available until the user has a Stripe customer id.",
        )

    stripe_sdk.api_key = settings.stripe_secret_key.strip()
    session = stripe_sdk.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    await _persist_user_billing(user["_id"], {"billing_provider": "stripe"})
    return BillingPortalOut(
        mode="stripe",
        status="created",
        portal_url=getattr(session, "url", None),
        customer_id=customer_id,
        message="Billing portal opened.",
    )


async def _store_webhook_event(event: dict, handled: bool, message: str | None = None) -> None:
    db = get_db()
    event_id = str(event.get("id") or "").strip()
    if not event_id:
        return
    await db["billing_events"].update_one(
        {"event_id": event_id},
        {
            "$set": {
                "event_id": event_id,
                "event_type": str(event.get("type") or "").strip(),
                "handled": handled,
                "message": message,
                "received_at": now_utc(),
                "payload": event,
            }
        },
        upsert=True,
    )


async def _handle_webhook_event(event: dict) -> bool:
    event_type = str(event.get("type") or "").strip()
    data = event.get("data") or {}
    obj = data.get("object") if isinstance(data, dict) else None
    if not isinstance(obj, dict):
        return False

    db = get_db()
    customer_id = str(obj.get("customer") or "").strip() or None
    subscription_id = str(obj.get("subscription") or obj.get("id") or "").strip() or None
    client_user_id = str(obj.get("client_reference_id") or "").strip() or None
    user = None
    if client_user_id:
        try:
            user = await db["users"].find_one({"_id": ObjectId(client_user_id)})
        except Exception:
            user = None
    if not user and customer_id:
        user = await db["users"].find_one({"stripe_customer_id": customer_id})
    if not user and subscription_id:
        user = await db["users"].find_one({"stripe_subscription_id": subscription_id})
    if not user:
        return False

    subscription_status = str(obj.get("status") or "").strip().lower()
    subscription_plan = str(user.get("subscription_plan") or "pro").strip() or "pro"
    if event_type == "checkout.session.completed":
        await _persist_user_billing(
            user["_id"],
            {
                "subscription_status": "active",
                "subscription_plan": subscription_plan,
                "subscription_started_at": user.get("subscription_started_at") or now_utc(),
                "subscription_renewal_at": _renewal_from_now(),
                "billing_provider": "stripe",
                "stripe_customer_id": customer_id or user.get("stripe_customer_id"),
                "stripe_subscription_id": subscription_id or user.get("stripe_subscription_id"),
                "stripe_checkout_session_id": str(obj.get("id") or "").strip() or user.get("stripe_checkout_session_id"),
            },
        )
        return True
    if event_type == "customer.subscription.updated":
        renewal_at = obj.get("current_period_end")
        if isinstance(renewal_at, (int, float)):
            renewal_at = datetime.fromtimestamp(float(renewal_at), tz=timezone.utc)
        await _persist_user_billing(
            user["_id"],
            {
                "subscription_status": "active" if subscription_status in {"active", "trialing"} else subscription_status or "active",
                "subscription_plan": subscription_plan,
                "subscription_renewal_at": renewal_at or user.get("subscription_renewal_at"),
                "billing_provider": "stripe",
                "stripe_customer_id": customer_id or user.get("stripe_customer_id"),
                "stripe_subscription_id": subscription_id or user.get("stripe_subscription_id"),
            },
        )
        return True
    if event_type == "customer.subscription.deleted":
        await _persist_user_billing(
            user["_id"],
            {
                "subscription_status": "inactive",
                "subscription_plan": None,
                "subscription_renewal_at": None,
                "billing_provider": "stripe",
                "stripe_customer_id": customer_id or user.get("stripe_customer_id"),
                "stripe_subscription_id": subscription_id or user.get("stripe_subscription_id"),
            },
        )
        return True
    if event_type == "invoice.payment_failed":
        await _persist_user_billing(
            user["_id"],
            {
                "subscription_status": "past_due",
                "billing_provider": "stripe",
                "stripe_customer_id": customer_id or user.get("stripe_customer_id"),
                "stripe_subscription_id": subscription_id or user.get("stripe_subscription_id"),
            },
        )
        return True
    return False


@router.get("/status", response_model=BillingStatusOut)
async def billing_status(user=Depends(require_user)):
    return _user_billing_status(user)


@router.post("/checkout", response_model=BillingCheckoutOut)
async def create_checkout_session(user=Depends(require_user)):
    if has_subscription_access(user):
        return BillingCheckoutOut(
            mode=_billing_mode(),
            status="already_active",
            customer_id=str(user.get("stripe_customer_id") or "").strip() or None,
            subscription_id=str(user.get("stripe_subscription_id") or "").strip() or None,
            dev_fallback_available=settings.app_env_normalized == "development",
            subscription_status=str(user.get("subscription_status") or "active").strip().lower() or "active",
            plan=str(user.get("subscription_plan") or "").strip() or None,
            renewal_at=user.get("subscription_renewal_at"),
            message="Subscription is already active.",
        )

    success_url = settings.stripe_success_url.strip() or f"{settings.public_app_url.rstrip('/')}/app/account?billing=success"
    cancel_url = settings.stripe_cancel_url.strip() or f"{settings.public_app_url.rstrip('/')}/app/account?billing=cancelled"
    return await _create_stripe_checkout(user, success_url=success_url, cancel_url=cancel_url)


@router.post("/portal", response_model=BillingPortalOut)
async def create_billing_portal(user=Depends(require_user)):
    return_url = settings.stripe_billing_portal_return_url.strip() or f"{settings.public_app_url.rstrip('/')}/app/account"
    return await _create_billing_portal(user, return_url=return_url)


@router.post("/webhook", response_model=BillingWebhookAck)
async def stripe_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("stripe-signature", "")
    if not settings.stripe_webhook_secret.strip() or stripe_sdk is None:
        await _store_webhook_event(
            {"id": f"placeholder-{abs(hash(raw_body))}", "type": "billing.placeholder"},
            handled=False,
            message="Webhook placeholder received payload without live Stripe verification.",
        )
        return BillingWebhookAck(
            received=True,
            status="noop",
            message="Stripe webhook processing is disabled until STRIPE_WEBHOOK_SECRET and the stripe SDK are configured.",
        )

    stripe_sdk.api_key = settings.stripe_secret_key.strip()
    try:
        event = stripe_sdk.Webhook.construct_event(raw_body, signature, settings.stripe_webhook_secret.strip())
    except Exception as exc:  # pragma: no cover - signature errors depend on live Stripe payloads.
        raise HTTPException(status_code=400, detail=f"Invalid Stripe webhook signature: {exc}") from exc

    handled = await _handle_webhook_event(event)
    await _store_webhook_event(event, handled=handled, message="Stripe webhook processed.")
    return BillingWebhookAck(
        received=True,
        status="processed" if handled else "ignored",
        event_type=str(event.get("type") or "").strip() or None,
        message="Stripe webhook processed.",
    )
