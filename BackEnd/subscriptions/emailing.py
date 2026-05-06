from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import TenantSubscription
from .invoices import (
    InvoiceLine,
    build_invoice_filename,
    build_invoice_number,
    build_payment_invoice_pdf,
)

logger = logging.getLogger(__name__)


def _can_send_email() -> bool:
    return bool(getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True))


def resolve_billing_recipient_email(*, tenant, fallback_email: str | None = None) -> str | None:
    if fallback_email:
        return fallback_email
    legal_profile = getattr(tenant, "legal_profile", None)
    if legal_profile and getattr(legal_profile, "company_email", ""):
        return legal_profile.company_email
    return None


def send_payment_success_email(
    *,
    tenant,
    recipient_email: str,
    subscriptions: list[TenantSubscription],
    transaction_id: str,
) -> None:
    if not recipient_email or not _can_send_email():
        return

    now = timezone.localtime(timezone.now())
    lines = []
    invoice_lines: list[InvoiceLine] = []
    total_amount_xof = 0
    for subscription in subscriptions:
        metadata = dict(subscription.metadata or {})
        purchased_months = int(metadata.get("purchased_months", 1) or 1)
        monthly_price = int(subscription.module.monthly_price_xof or 0)
        line_subtotal = int(metadata.get("line_subtotal_xof", 0) or 0)
        total_amount_xof += line_subtotal
        renewal_at_text = (
            timezone.localtime(subscription.renewal_at).strftime("%Y-%m-%d %H:%M:%S %Z")
            if subscription.renewal_at
            else "-"
        )
        lines.append(
            {
                "module_name": subscription.module.name,
                "months": max(purchased_months, 1),
                "renewal_at": renewal_at_text,
                "line_subtotal_xof": line_subtotal,
            }
        )
        invoice_lines.append(
            InvoiceLine(
                module_name=subscription.module.name,
                months=max(purchased_months, 1),
                unit_price_xof=monthly_price,
                subtotal_xof=line_subtotal,
                renewal_at_text=renewal_at_text,
            )
        )

    legal_profile = getattr(tenant, "legal_profile", None)
    buyer_name = (
        getattr(legal_profile, "legal_name", None)
        or getattr(tenant, "name", None)
        or "Entreprise"
    )
    buyer_email = recipient_email
    invoice_number = build_invoice_number(transaction_id)
    invoice_filename = build_invoice_filename(transaction_id)

    context = {
        "app_name": "CorpCore",
        "title": "Paiement confirme",
        "preheader": "Votre paiement a ete confirme et vos modules sont actifs.",
        "headline": "Paiement confirme",
        "subtitle": "Vos modules ont ete actives avec succes.",
        "tenant_name": getattr(tenant, "name", "Entreprise"),
        "transaction_id": transaction_id,
        "payment_time": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "invoice_number": invoice_number,
        "lines": lines,
        "total_amount_xof": total_amount_xof,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }

    subject = f"[CorpCore] Paiement confirme - {context['tenant_name']}"
    text_body = render_to_string("emails/payment_success.txt", context)
    html_body = render_to_string("emails/payment_success.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    message.attach_alternative(html_body, "text/html")
    try:
        pdf_bytes = build_payment_invoice_pdf(
            tenant_name=getattr(tenant, "name", "Entreprise"),
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            transaction_id=transaction_id,
            invoice_number=invoice_number,
            payment_time=now,
            lines=invoice_lines,
        )
        message.attach(invoice_filename, pdf_bytes, "application/pdf")
    except Exception:
        logger.exception("Failed to generate PDF invoice tx=%s tenant=%s", transaction_id, getattr(tenant, "id", None))
    message.send(fail_silently=False)
    logger.info("Payment success email sent to %s (tenant=%s)", recipient_email, getattr(tenant, "id", None))


def send_subscription_expiry_reminder_email(
    *,
    tenant,
    recipient_email: str,
    subscription: TenantSubscription,
    days_remaining: int,
) -> None:
    if not recipient_email or not _can_send_email():
        return

    metadata = dict(subscription.metadata or {})
    amount_xof = int(metadata.get("line_subtotal_xof", 0) or 0)
    purchased_months = int(metadata.get("purchased_months", 1) or 1)
    renewal_text = (
        timezone.localtime(subscription.renewal_at).strftime("%Y-%m-%d %H:%M:%S %Z")
        if subscription.renewal_at
        else "-"
    )

    context = {
        "app_name": "CorpCore",
        "title": "Expiration imminente",
        "preheader": f"Votre module expire dans {days_remaining} jour(s).",
        "headline": f"Expiration dans {days_remaining} jour(s)",
        "subtitle": "Pensez a renouveler votre abonnement pour eviter l'interruption du service.",
        "tenant_name": getattr(tenant, "name", "Entreprise"),
        "module_name": subscription.module.name,
        "days_remaining": days_remaining,
        "renewal_at": renewal_text,
        "purchased_months": max(purchased_months, 1),
        "amount_xof": amount_xof,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }

    subject = f"[CorpCore] Rappel expiration ({days_remaining}j) - {subscription.module.name}"
    text_body = render_to_string("emails/subscription_expiry_reminder.txt", context)
    html_body = render_to_string("emails/subscription_expiry_reminder.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)
    logger.info(
        "Expiry reminder email sent to %s (tenant=%s module=%s days=%s)",
        recipient_email,
        getattr(tenant, "id", None),
        subscription.module_id,
        days_remaining,
    )
