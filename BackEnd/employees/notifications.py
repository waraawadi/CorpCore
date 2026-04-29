import logging
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _tenant_label(tenant) -> str:
    if not tenant:
        return "CorpCore"
    return getattr(tenant, "name", None) or getattr(tenant, "schema_name", None) or "CorpCore"


def _tenant_login_url(tenant) -> str:
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
        if not tenant_domain:
            try:
                primary = tenant.get_primary_domain()
                tenant_domain = (getattr(primary, "domain", "") or "").strip()
            except Exception:
                tenant_domain = ""

    if tenant_domain:
        parsed_domain = urlparse(tenant_domain if "://" in tenant_domain else f"{scheme}://{tenant_domain}")
        host = parsed_domain.netloc or parsed_domain.path
        if host and ":" not in host and public_port and host.endswith(".localhost"):
            host = f"{host}:{public_port}"
        if host:
            return f"{scheme}://{host}/login"

    return f"{public_base.rstrip('/')}/login"


def send_employee_credentials(*, tenant, email: str, full_name: str, temp_password: str) -> None:
    if not email:
        return
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True):
        return
    tenant_name = _tenant_label(tenant)
    login_url = _tenant_login_url(tenant)
    context = {
        "app_name": "CorpCore",
        "title": "Vos acces employe",
        "preheader": f"Votre compte employe {tenant_name} est pret.",
        "headline": "Votre compte employe est pret",
        "subtitle": "Utilisez les identifiants ci-dessous pour vous connecter.",
        "full_name": full_name,
        "email": email,
        "temp_password": temp_password,
        "tenant_name": tenant_name,
        "login_url": login_url,
        "year": datetime.now().year,
        "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
    }
    subject = f"[CorpCore] Vos acces - {tenant_name}"
    text_body = render_to_string("emails/employee_credentials.txt", context)
    html_body = render_to_string("emails/employee_credentials.html", context)
    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
    except Exception:
        logger.exception("Impossible d'envoyer l'email de credentials a %s", email)


def send_employee_credentials_whatsapp(*, phone: str, full_name: str, email: str, temp_password: str) -> None:
    base_url = (getattr(settings, "WHATSAPP_API_BASE_URL", "") or "").strip()
    token = (getattr(settings, "WHATSAPP_API_TOKEN", "") or "").strip()
    if not base_url or not token or not phone:
        return

    payload = {
        "to": phone,
        "message": (
            f"Bonjour {full_name}. Votre compte employe est cree. "
            f"Login: {email} | Mot de passe temporaire: {temp_password}. "
            "Merci de le changer des votre premiere connexion."
        ),
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    endpoint = urljoin(base_url if base_url.endswith("/") else f"{base_url}/", "messages")
    try:
        requests.post(endpoint, json=payload, headers=headers, timeout=10)
    except Exception:
        logger.exception("Impossible d'envoyer le WhatsApp de credentials a %s", phone)


def _leave_frontend_url(tenant) -> str:
    base = _tenant_login_url(tenant).replace("/login", "")
    return f"{base.rstrip('/')}/dashboard/hr"


_LEAVE_TYPE_FR = {
    "annual": "Conges payes",
    "sick": "Maladie",
    "unpaid": "Sans solde",
    "maternity": "Maternite",
    "other": "Autre",
}


def notify_leave_request_submitted(*, tenant, leave) -> None:
    """E-mail + notification in-app au manager lors d'une nouvelle demande."""
    try:
        from projects.notifications import create_in_app_notification
    except Exception:
        create_in_app_notification = None

    manager = getattr(leave.employee, "manager", None)
    if not manager or not getattr(manager, "email", None):
        return
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True):
        pass
    else:
        emp_name = leave.employee.user.get_full_name() or leave.employee.user.username
        context = {
            "app_name": "CorpCore",
            "title": "Nouvelle demande de conge",
            "preheader": f"{emp_name} a soumis une demande de conge.",
            "headline": "Nouvelle demande de conge",
            "employee_name": emp_name,
            "leave_type": _LEAVE_TYPE_FR.get(leave.leave_type, leave.leave_type),
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "days": str(leave.days),
            "reason": leave.reason or "—",
            "tenant_name": _tenant_label(tenant),
            "hr_url": _leave_frontend_url(tenant),
            "year": datetime.now().year,
            "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
        }
        subject = f"[CorpCore] Demande de conge - {emp_name} - {_tenant_label(tenant)}"
        try:
            text_body = render_to_string("emails/leave_request_submitted.txt", context)
            html_body = render_to_string("emails/leave_request_submitted.html", context)
            message = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[manager.email],
            )
            message.attach_alternative(html_body, "text/html")
            message.send(fail_silently=False)
        except Exception:
            logger.exception("Echec envoi email demande conge au manager")

    if create_in_app_notification and manager:
        emp_name = leave.employee.user.get_full_name() or leave.employee.user.username
        create_in_app_notification(
            recipient=manager,
            title="Demande de conge",
            message=f"{emp_name} du {leave.start_date} au {leave.end_date} ({leave.days} j.).",
            notification_type="info",
            link_url="/dashboard/hr",
        )


def notify_leave_decision(*, tenant, leave, decision: str) -> None:
    """decision: approved | rejected — e-mail + in-app a l'employe."""
    try:
        from projects.notifications import create_in_app_notification
    except Exception:
        create_in_app_notification = None

    user = leave.employee.user
    email = getattr(user, "email", None)
    if email and getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", True):
        context = {
            "app_name": "CorpCore",
            "title": "Votre demande de conge",
            "preheader": f"Decision: {decision}",
            "headline": "Decision sur votre demande de conge",
            "decision_label": "Approuvee" if decision == "approved" else "Refusee",
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "days": str(leave.days),
            "tenant_name": _tenant_label(tenant),
            "hr_url": _leave_frontend_url(tenant),
            "year": datetime.now().year,
            "support_email": getattr(settings, "DEFAULT_FROM_EMAIL", "support@corpcore.app"),
        }
        subject = f"[CorpCore] Conge {context['decision_label']} - {_tenant_label(tenant)}"
        try:
            text_body = render_to_string("emails/leave_request_decision.txt", context)
            html_body = render_to_string("emails/leave_request_decision.html", context)
            message = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email],
            )
            message.attach_alternative(html_body, "text/html")
            message.send(fail_silently=False)
        except Exception:
            logger.exception("Echec envoi email decision conge a l'employe")

    if create_in_app_notification and user:
        msg = (
            f"Votre demande du {leave.start_date} au {leave.end_date} a ete "
            f"{'approuvee' if decision == 'approved' else 'refusee'}."
        )
        create_in_app_notification(
            recipient=user,
            title="Conge " + ("approuve" if decision == "approved" else "refuse"),
            message=msg,
            notification_type="success" if decision == "approved" else "warning",
            link_url="/dashboard/hr",
        )

