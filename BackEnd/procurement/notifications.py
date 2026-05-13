"""Notifications e-mail pour le module achats (demandes, bons de commande)."""

from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings
from django.db import connection
from django_tenants.utils import schema_context

from projects.notifications import _can_send_email, _send_email, _tenant_frontend_base_url, _tenant_label

from tenants.models import Client

logger = logging.getLogger(__name__)


def _resolve_tenant() -> Client | None:
    schema = getattr(connection, "schema_name", None) or "public"
    public = getattr(settings, "PUBLIC_SCHEMA_NAME", "public")
    if schema == public:
        return None
    with schema_context(public):
        return Client.objects.filter(schema_name=schema).first()


def _company_contact_email(tenant: Client | None) -> str:
    if tenant is None:
        return ""
    try:
        return (tenant.legal_profile.company_email or "").strip()
    except Exception:
        return ""


def _procurement_requests_url(tenant) -> str:
    return f"{_tenant_frontend_base_url(tenant).rstrip('/')}/dashboard/procurement/requests"


def _procurement_orders_url(tenant) -> str:
    return f"{_tenant_frontend_base_url(tenant).rstrip('/')}/dashboard/procurement/orders"


def _user_requester_label(user) -> str:
    if user is None:
        return "Un utilisateur"
    return (user.get_full_name() or user.get_username() or user.email or str(user.pk)).strip()


def notify_procurement_request_submitted(*, tenant, request_obj, actor) -> None:
    """Demande passee en Soumise : alerte l'e-mail societe (profil legal) pour traitement."""
    to = _company_contact_email(tenant)
    if not to or not _can_send_email():
        return
    tenant_name = _tenant_label(tenant)
    actor_name = _user_requester_label(actor)
    url = _procurement_requests_url(tenant)
    context = {
        "app_name": "CorpCore",
        "title": "Demande d'achat soumise",
        "headline": "Nouvelle demande d'achat",
        "subtitle": f"Une demande vient d'etre soumise sur {tenant_name}.",
        "preheader": f"Demande d'achat {request_obj.reference} soumise.",
        "tenant_name": tenant_name,
        "request_reference": request_obj.reference,
        "request_title": request_obj.title,
        "actor_name": actor_name,
        "procurement_url": url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] Demande d'achat soumise — {request_obj.reference}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/procurement_request_submitted.txt",
            html_template="emails/procurement_request_submitted.html",
            context=context,
        )
    except Exception:
        logger.exception("Procurement: e-mail soumission demande impossible pour %s", to)


def notify_procurement_request_decision(*, tenant, request_obj, approved: bool) -> None:
    """Demande approuvee ou rejetee : informe le demandeur."""
    user = request_obj.requested_by
    to = (getattr(user, "email", None) or "").strip() if user else ""
    if not to or not _can_send_email():
        return
    tenant_name = _tenant_label(tenant)
    url = _procurement_requests_url(tenant)
    decision_label = "approuvee" if approved else "rejetee"
    context = {
        "app_name": "CorpCore",
        "title": f"Demande {decision_label}",
        "headline": f"Votre demande est {decision_label}",
        "subtitle": f"Reference {request_obj.reference} sur {tenant_name}.",
        "preheader": f"Demande {request_obj.reference} {decision_label}.",
        "tenant_name": tenant_name,
        "request_reference": request_obj.reference,
        "request_title": request_obj.title,
        "approved": approved,
        "decision_label": decision_label,
        "procurement_url": url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] Demande d'achat {decision_label} — {request_obj.reference}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/procurement_request_decision.txt",
            html_template="emails/procurement_request_decision.html",
            context=context,
        )
    except Exception:
        logger.exception("Procurement: e-mail decision demande impossible pour %s", to)


def notify_procurement_request_fulfilled(*, tenant, request_obj, order_reference: str) -> None:
    """Demande transformee (liee a un BC) : informe le demandeur."""
    user = request_obj.requested_by
    to = (getattr(user, "email", None) or "").strip() if user else ""
    if not to or not _can_send_email():
        return
    tenant_name = _tenant_label(tenant)
    url = _procurement_orders_url(tenant)
    context = {
        "app_name": "CorpCore",
        "title": "Demande transformee",
        "headline": "Votre demande a ete transformee",
        "subtitle": f"Un bon de commande a ete cree a partir de la demande {request_obj.reference}.",
        "preheader": f"Demande {request_obj.reference} transformee en bon {order_reference}.",
        "tenant_name": tenant_name,
        "request_reference": request_obj.reference,
        "order_reference": order_reference,
        "procurement_url": url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] Demande transformee — {request_obj.reference} → {order_reference}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/procurement_request_fulfilled.txt",
            html_template="emails/procurement_request_fulfilled.html",
            context=context,
        )
    except Exception:
        logger.exception("Procurement: e-mail transformation demande impossible pour %s", to)


def notify_procurement_order_sent_to_supplier(*, tenant, order) -> None:
    """Bon passe en Envoyee : informe le fournisseur (e-mail fournisseur)."""
    supplier = order.supplier
    to = (supplier.email or "").strip()
    if not to or not _can_send_email():
        return
    tenant_name = _tenant_label(tenant)
    context = {
        "app_name": "CorpCore",
        "title": "Bon de commande",
        "headline": f"Bon de commande {order.reference}",
        "subtitle": f"{tenant_name} vous transmet un bon de commande.",
        "preheader": f"Bon {order.reference} — {tenant_name}.",
        "tenant_name": tenant_name,
        "supplier_name": supplier.name,
        "order_reference": order.reference,
        "total_amount": str(order.total_amount),
        "notes": (order.notes or "").strip() or "—",
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] Bon de commande {order.reference}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/procurement_order_sent.txt",
            html_template="emails/procurement_order_sent.html",
            context=context,
        )
    except Exception:
        logger.exception("Procurement: e-mail bon fournisseur impossible pour %s", to)


def notify_procurement_order_internal(*, tenant, order, event: str) -> None:
    """Evenements internes (creation BC, reception) : copie a l'e-mail societe si configure."""
    to = _company_contact_email(tenant)
    if not to or not _can_send_email():
        return
    tenant_name = _tenant_label(tenant)
    url = _procurement_orders_url(tenant)
    headlines = {
        "created": "Nouveau bon de commande",
        "received": "Bon de commande recu",
    }
    subtitles = {
        "created": f"Un bon a ete cree chez {order.supplier.name}.",
        "received": f"Le bon {order.reference} est marque comme recu.",
    }
    context = {
        "app_name": "CorpCore",
        "title": headlines.get(event, "Achats"),
        "headline": headlines.get(event, "Notification achats"),
        "subtitle": subtitles.get(event, ""),
        "preheader": f"{order.reference} — {tenant_name}.",
        "tenant_name": tenant_name,
        "order_reference": order.reference,
        "supplier_name": order.supplier.name,
        "status": order.get_status_display(),
        "total_amount": str(order.total_amount),
        "procurement_url": url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] {headlines.get(event, 'Achats')} — {order.reference}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/procurement_order_internal.txt",
            html_template="emails/procurement_order_internal.html",
            context=context,
        )
    except Exception:
        logger.exception("Procurement: e-mail interne BC impossible pour %s", to)
