from celery import shared_task
from django.utils import timezone

from .models import TenantSubscription
from .emailing import resolve_billing_recipient_email, send_subscription_expiry_reminder_email


@shared_task
def enforce_subscription_grace_periods() -> int:
    now = timezone.now()
    updated = (
        TenantSubscription.objects.filter(
            status=TenantSubscription.STATUS_GRACE,
            grace_until__isnull=False,
            grace_until__lt=now,
        )
        .exclude(status=TenantSubscription.STATUS_SUSPENDED)
        .update(status=TenantSubscription.STATUS_SUSPENDED)
    )
    return int(updated)


@shared_task
def expire_trial_subscriptions() -> int:
    now = timezone.now()
    trial_qs = TenantSubscription.objects.filter(
        status=TenantSubscription.STATUS_ACTIVE,
        metadata__trial=True,
        renewal_at__isnull=False,
        renewal_at__lt=now,
    )
    affected_tenant_ids = list(trial_qs.values_list("tenant_id", flat=True).distinct())
    updated = trial_qs.update(status=TenantSubscription.STATUS_SUSPENDED)
    if affected_tenant_ids:
        from tenants.models import Client

        Client.objects.filter(id__in=affected_tenant_ids).update(on_trial=False)
    return int(updated)


@shared_task
def send_subscription_expiry_reminders() -> int:
    """
    Send reminders at J-7, J-3 and J-1 before renewal/expiry.
    """
    now = timezone.now()
    reminder_days = {7, 3, 1}
    sent_count = 0

    qs = TenantSubscription.objects.filter(
        status__in=[TenantSubscription.STATUS_ACTIVE, TenantSubscription.STATUS_GRACE],
        renewal_at__isnull=False,
    ).select_related("tenant", "module", "tenant__legal_profile")

    for subscription in qs:
        renewal_at = subscription.renewal_at
        if renewal_at is None:
            continue
        days_remaining = (renewal_at.date() - now.date()).days
        if days_remaining not in reminder_days:
            continue

        metadata = dict(subscription.metadata or {})
        sent_days = {int(d) for d in metadata.get("expiry_reminders_sent_days", []) if str(d).isdigit()}
        if days_remaining in sent_days:
            continue

        tenant = subscription.tenant
        recipient_email = resolve_billing_recipient_email(tenant=tenant)
        if not recipient_email:
            continue

        try:
            send_subscription_expiry_reminder_email(
                tenant=tenant,
                recipient_email=recipient_email,
                subscription=subscription,
                days_remaining=days_remaining,
            )
        except Exception:
            # Keep processing other subscriptions even if one send fails.
            continue

        sent_days.add(days_remaining)
        metadata["expiry_reminders_sent_days"] = sorted(sent_days, reverse=True)
        subscription.metadata = metadata
        subscription.save(update_fields=["metadata", "updated_at"])
        sent_count += 1

    return int(sent_count)
