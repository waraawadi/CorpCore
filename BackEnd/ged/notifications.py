"""Emails pour les actions de partage GED."""

from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings

from projects.notifications import _can_send_email, _send_email, _tenant_frontend_base_url, _tenant_label

from .models import GedShare

logger = logging.getLogger(__name__)


def _item_label(share: GedShare) -> str:
    if share.folder_id:
        return f"dossier « {share.folder.name} »"
    if share.document_id:
        return f"fichier « {share.document.title} »"
    return "element GED"


def _role_label(role: str) -> str:
    return "modification" if role == GedShare.ROLE_EDITOR else "lecture seule"


def notify_ged_share_created(*, tenant, share: GedShare, actor) -> None:
    to = (getattr(share.shared_with, "email", None) or "").strip()
    if not to or not _can_send_email():
        return
    actor_name = actor.get_full_name() or actor.get_username() or actor.email or str(actor.pk)
    tenant_name = _tenant_label(tenant)
    base_url = _tenant_frontend_base_url(tenant)
    ged_url = f"{base_url}/dashboard/ged"
    context = {
        "app_name": "CorpCore",
        "title": "Nouveau partage GED",
        "preheader": f"{actor_name} vous a donne acces a un document.",
        "recipient_name": share.shared_with.get_full_name() or share.shared_with.get_username() or "",
        "actor_name": actor_name,
        "tenant_name": tenant_name,
        "item_label": _item_label(share),
        "role_label": _role_label(share.role),
        "ged_url": ged_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] Partage GED : {_item_label(share)}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/ged_share_created.txt",
            html_template="emails/ged_share_created.html",
            context=context,
        )
    except Exception:
        logger.exception("GED: impossible d'envoyer l'email de partage a %s", to)


def notify_ged_share_role_changed(*, tenant, share: GedShare, actor, old_role: str) -> None:
    to = (getattr(share.shared_with, "email", None) or "").strip()
    if not to or not _can_send_email():
        return
    actor_name = actor.get_full_name() or actor.get_username() or actor.email or str(actor.pk)
    tenant_name = _tenant_label(tenant)
    base_url = _tenant_frontend_base_url(tenant)
    ged_url = f"{base_url}/dashboard/ged"
    context = {
        "app_name": "CorpCore",
        "title": "Droit de partage modifie",
        "preheader": "Vos droits sur un element partage ont change.",
        "recipient_name": share.shared_with.get_full_name() or share.shared_with.get_username() or "",
        "actor_name": actor_name,
        "tenant_name": tenant_name,
        "item_label": _item_label(share),
        "old_role_label": _role_label(old_role),
        "new_role_label": _role_label(share.role),
        "ged_url": ged_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] GED : droits mis a jour sur {_item_label(share)}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/ged_share_role_changed.txt",
            html_template="emails/ged_share_role_changed.html",
            context=context,
        )
    except Exception:
        logger.exception("GED: impossible d'envoyer l'email de changement de role a %s", to)


def notify_ged_share_revoked(
    *,
    tenant,
    recipient,
    item_label: str,
    actor,
) -> None:
    to = (getattr(recipient, "email", None) or "").strip()
    if not to or not _can_send_email():
        return
    actor_name = actor.get_full_name() or actor.get_username() or actor.email or str(actor.pk)
    tenant_name = _tenant_label(tenant)
    base_url = _tenant_frontend_base_url(tenant)
    ged_url = f"{base_url}/dashboard/ged"
    context = {
        "app_name": "CorpCore",
        "title": "Partage retire",
        "preheader": "Vous n'avez plus acces a un element partage.",
        "recipient_name": recipient.get_full_name() or recipient.get_username() or "",
        "actor_name": actor_name,
        "tenant_name": tenant_name,
        "item_label": item_label,
        "ged_url": ged_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@corpcore.app"),
    }
    subject = f"[{tenant_name}] GED : acces retire pour {item_label}"
    try:
        _send_email(
            to_email=to,
            subject=subject,
            text_template="emails/ged_share_revoked.txt",
            html_template="emails/ged_share_revoked.html",
            context=context,
        )
    except Exception:
        logger.exception("GED: impossible d'envoyer l'email de retrait de partage a %s", to)
