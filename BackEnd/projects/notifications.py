from __future__ import annotations

import logging
from datetime import datetime
from urllib.parse import urlparse

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import InAppNotification

logger = logging.getLogger(__name__)


def _can_send_email() -> bool:
    return bool(getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True))


def _tenant_label(tenant) -> str:
    if not tenant:
        return "CorpCore"
    return getattr(tenant, "name", None) or getattr(tenant, "schema_name", None) or "CorpCore"


def _tenant_frontend_base_url(tenant) -> str:
    public_base = (getattr(settings, "PUBLIC_FRONTEND_BASE_URL", "") or "").strip() or "http://localhost:3000"
    parsed_public = urlparse(public_base if "://" in public_base else f"https://{public_base}")
    scheme = parsed_public.scheme or "https"
    public_port = parsed_public.port

    tenant_domain = ""
    if tenant is not None:
        try:
            tenant_domain = (
                tenant.domains.filter(is_primary=True).values_list("domain", flat=True).first()
                or ""
            ).strip()
        except Exception:
            tenant_domain = ""

    if tenant_domain:
        parsed_domain = urlparse(tenant_domain if "://" in tenant_domain else f"{scheme}://{tenant_domain}")
        host = parsed_domain.netloc or parsed_domain.path
        if host and ":" not in host and public_port and host.endswith(".localhost"):
            host = f"{host}:{public_port}"
        if host:
            return f"{scheme}://{host}"

    return public_base.rstrip("/")


def _send_email(*, to_email: str, subject: str, text_template: str, html_template: str, context: dict) -> None:
    if not to_email or not _can_send_email():
        return
    text_body = render_to_string(text_template, context)
    html_body = render_to_string(html_template, context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def create_in_app_notification(
    *,
    recipient,
    title: str,
    message: str,
    notification_type: str = InAppNotification.TYPE_INFO,
    link_url: str = "",
    metadata: dict | None = None,
) -> None:
    if recipient is None:
        return
    InAppNotification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        link_url=link_url or "",
        metadata=metadata or {},
    )


def notify_team_update(
    *,
    tenant,
    recipient_email: str,
    team_name: str,
    actor_name: str,
    action_label: str,
    leader_name: str,
    members_summary: str,
) -> None:
    context = {
        "app_name": "CorpCore",
        "title": "Mise a jour equipe",
        "preheader": f"Equipe {team_name}: {action_label}.",
        "headline": f"Equipe {team_name}",
        "subtitle": action_label,
        "tenant_name": _tenant_label(tenant),
        "team_name": team_name,
        "actor_name": actor_name,
        "leader_name": leader_name or "Aucun",
        "members_summary": members_summary or "Aucun membre",
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }
    subject = f"[CorpCore] Equipe mise a jour - {team_name}"
    try:
        _send_email(
            to_email=recipient_email,
            subject=subject,
            text_template="emails/team_event.txt",
            html_template="emails/team_event.html",
            context=context,
        )
    except Exception:
        logger.exception("Impossible d'envoyer la notification equipe a %s", recipient_email)


def notify_project_assignment(
    *,
    tenant,
    recipient_email: str,
    project_name: str,
    team_name: str,
    actor_name: str,
    project_id: str,
) -> None:
    project_url = f"{_tenant_frontend_base_url(tenant)}/dashboard/projects/{project_id}"
    context = {
        "app_name": "CorpCore",
        "title": "Projet assigne a une equipe",
        "preheader": f"Le projet {project_name} est affecte a l'equipe {team_name}.",
        "headline": "Projet affecte",
        "subtitle": "Un projet vient d'etre affecte a votre equipe.",
        "tenant_name": _tenant_label(tenant),
        "project_name": project_name,
        "team_name": team_name,
        "actor_name": actor_name,
        "project_url": project_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }
    subject = f"[CorpCore] Projet affecte - {project_name}"
    try:
        _send_email(
            to_email=recipient_email,
            subject=subject,
            text_template="emails/project_team_assignment.txt",
            html_template="emails/project_team_assignment.html",
            context=context,
        )
    except Exception:
        logger.exception("Impossible d'envoyer la notification projet a %s", recipient_email)


def notify_task_assignment(
    *,
    tenant,
    recipient_email: str,
    project_name: str,
    task_title: str,
    actor_name: str,
    project_id: str,
) -> None:
    task_url = f"{_tenant_frontend_base_url(tenant)}/dashboard/projects/{project_id}"
    context = {
        "app_name": "CorpCore",
        "title": "Tache assignee",
        "preheader": f"Vous avez ete assigne a la tache {task_title}.",
        "headline": "Nouvelle tache assignee",
        "subtitle": "Une tache de projet vous a ete attribuee.",
        "tenant_name": _tenant_label(tenant),
        "project_name": project_name,
        "task_title": task_title,
        "actor_name": actor_name,
        "task_url": task_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }
    subject = f"[CorpCore] Tache assignee - {task_title}"
    try:
        _send_email(
            to_email=recipient_email,
            subject=subject,
            text_template="emails/task_assignment.txt",
            html_template="emails/task_assignment.html",
            context=context,
        )
    except Exception:
        logger.exception("Impossible d'envoyer la notification tache a %s", recipient_email)


def notify_project_membership_update(
    *,
    tenant,
    recipient_email: str,
    project_name: str,
    actor_name: str,
    project_id: str,
    action: str,
) -> None:
    """
    Notification email lors d'un ajout/retrait de membre sur un projet.
    action: "added" | "removed"
    """
    if action not in {"added", "removed"}:
        action = "added"
    project_url = f"{_tenant_frontend_base_url(tenant)}/dashboard/projects/{project_id}"
    context = {
        "app_name": "CorpCore",
        "title": "Mise a jour membres projet",
        "preheader": (
            f"Vous avez ete ajoute au projet {project_name}."
            if action == "added"
            else f"Vous avez ete retire du projet {project_name}."
        ),
        "headline": "Acces projet mis a jour",
        "subtitle": (
            "Vous faites maintenant partie du projet."
            if action == "added"
            else "Votre acces au projet a ete retire."
        ),
        "tenant_name": _tenant_label(tenant),
        "project_name": project_name,
        "team_name": "Projet",
        "actor_name": actor_name,
        "project_url": project_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }
    subject = (
        f"[CorpCore] Ajout au projet - {project_name}"
        if action == "added"
        else f"[CorpCore] Retrait du projet - {project_name}"
    )
    try:
        _send_email(
            to_email=recipient_email,
            subject=subject,
            text_template="emails/project_team_assignment.txt",
            html_template="emails/project_team_assignment.html",
            context=context,
        )
    except Exception:
        logger.exception("Impossible d'envoyer la notification membres projet a %s", recipient_email)

