from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


def _safe_host(request) -> str:
    if request is None:
        return "inconnu"
    try:
        return request.get_host()
    except Exception:
        return "inconnu"


def _safe_ip(request) -> str:
    if request is None:
        return "inconnue"
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "inconnue")


def _safe_user_agent(request) -> str:
    if request is None:
        return "inconnu"
    return (request.META.get("HTTP_USER_AGENT") or "inconnu").strip()


def send_login_notification_email(*, user, tenant, request) -> None:
    """
    Send a modern login notification email after successful authentication.
    Non-blocking callers should catch and swallow exceptions.
    """
    if user is None or not getattr(user, "email", ""):
        return
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True):
        logger.info("EMAIL_NOTIFICATIONS_ENABLED disabled, skip login notification email.")
        return

    host = _safe_host(request)
    now = timezone.localtime(timezone.now())
    tenant_name = getattr(tenant, "name", None) or "Espace public"
    tenant_schema = getattr(tenant, "schema_name", None) or "public"
    ip_address = _safe_ip(request)
    user_agent = _safe_user_agent(request)
    support_email = getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app")

    context = {
        "app_name": "CorpCore",
        "title": "Connexion detectee",
        "preheader": "Nouvelle connexion detectee sur votre compte CorpCore.",
        "headline": "Nouvelle connexion detectee",
        "subtitle": "Un acces a votre compte vient d'etre enregistre.",
        "user_full_name": (f"{user.first_name} {user.last_name}".strip() or user.username or user.email),
        "user_email": user.email,
        "tenant_name": tenant_name,
        "tenant_schema": tenant_schema,
        "host": host,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "login_time": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "year": datetime.now().year,
        "support_email": support_email,
    }

    subject = f"[CorpCore] Connexion reussie - {tenant_name}"
    text_body = render_to_string("emails/login_success.txt", context)
    html_body = render_to_string("emails/login_success.html", context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)

    logger.info("Login notification email sent to %s", user.email)
