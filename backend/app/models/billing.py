"""Pydantic schemas for billing status, checkout sessions, portal links, and webhooks."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from typing import List


class BillingPlanOut(BaseModel):
    key: str
    label: str
    price_monthly: int
    price_display: str
    description: str
    features: List[str]
    recommended: bool = False
    checkout_available: bool = False


class BillingCheckoutIn(BaseModel):
    plan: Optional[str] = None


class BillingStatusOut(BaseModel):
    provider: str = "stripe"
    mode: str = "unavailable"
    configured: bool = False
    checkout_available: bool = False
    portal_available: bool = False
    dev_fallback_available: bool = False
    message: str = ""
    subscription_status: str = "inactive"
    current_plan: Optional[str] = None
    billing_provider: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_checkout_session_id: Optional[str] = None
    plans: List[BillingPlanOut] = []


class BillingCheckoutOut(BaseModel):
    provider: str = "stripe"
    mode: str = "unavailable"
    status: str = "unavailable"
    checkout_url: Optional[str] = None
    session_id: Optional[str] = None
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    dev_fallback_available: bool = False
    subscription_status: str = "inactive"
    plan: Optional[str] = None
    renewal_at: Optional[datetime] = None
    message: Optional[str] = None


class BillingPortalOut(BaseModel):
    provider: str = "stripe"
    mode: str = "unavailable"
    status: str = "unavailable"
    portal_url: Optional[str] = None
    customer_id: Optional[str] = None
    message: Optional[str] = None


class BillingWebhookAck(BaseModel):
    received: bool = True
    status: str = "noop"
    event_type: Optional[str] = None
    message: Optional[str] = None
