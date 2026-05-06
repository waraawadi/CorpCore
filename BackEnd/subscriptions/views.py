from datetime import timedelta
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from fedapay import WebhookSignature
from rest_framework import permissions, response, status, viewsets
from rest_framework.views import APIView

from .models import BillingModule, TenantSubscription
from .serializers import (
    BillingModuleSerializer,
    InitiateModulePaymentSerializer,
    SyncModulePaymentSerializer,
    TenantSubscriptionSerializer,
)
from .services import (
    create_module_transaction,
    extract_transaction_id,
    extract_transaction_status,
    get_transaction_payment_url,
    get_transaction,
)
from .emailing import resolve_billing_recipient_email, send_payment_success_email
from finance.services import record_billing_payment_to_finance


logger = logging.getLogger(__name__)


def _compute_extended_renewal_at(subscription: TenantSubscription, now, purchased_months: int):
    months = max(int(purchased_months or 1), 1)
    # If subscription is still active in the future, extend from existing expiry.
    # Otherwise extend from current time.
    anchor = subscription.renewal_at if subscription.renewal_at and subscription.renewal_at > now else now
    return anchor + timedelta(days=30 * months)


class BillingModuleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BillingModuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BillingModule.objects.filter(is_active=True).order_by("monthly_price_xof")


class TenantSubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TenantSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant or getattr(tenant, "schema_name", "public") == "public":
            return TenantSubscription.objects.none()
        return TenantSubscription.objects.filter(tenant=tenant).select_related("module").order_by("-updated_at")


class InitiateModulePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant or getattr(tenant, "schema_name", "public") == "public":
            return response.Response(
                {"detail": "Le paiement module est disponible uniquement dans un tenant entreprise."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = InitiateModulePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        module_ids = serializer.validated_data.get("module_ids", [])
        module_months = serializer.validated_data.get("module_months", {})
        modules = list(BillingModule.objects.filter(id__in=module_ids, is_active=True).order_by("id"))
        if len(modules) != len(set(module_ids)):
            return response.Response({"detail": "Un ou plusieurs modules sont introuvables ou inactifs."}, status=status.HTTP_404_NOT_FOUND)

        months_by_module = {}
        module_lines = []
        total_amount = 0
        for module in modules:
            months = int(module_months.get(str(module.id), 1))
            months = max(months, 1)
            subtotal = int(module.monthly_price_xof or 0) * months
            total_amount += subtotal
            months_by_module[str(module.id)] = months
            module_lines.append(
                {
                    "module_id": str(module.id),
                    "module_code": module.code,
                    "module_name": module.name,
                    "months": months,
                    "monthly_price_xof": int(module.monthly_price_xof or 0),
                    "subtotal_xof": subtotal,
                }
            )
        if total_amount <= 0:
            return response.Response({"detail": "Montant de paiement invalide pour la selection."}, status=status.HTTP_400_BAD_REQUEST)
        module_codes = [module.code for module in modules]
        module_names = [module.name for module in modules]

        callback_url = serializer.validated_data.get("callback_url") or f"{settings.PUBLIC_FRONTEND_BASE_URL}/billing/success"
        tx_payload = create_module_transaction(
            amount=total_amount,
            description=f"Activation modules ({len(modules)}): {', '.join(module_names)}",
            callback_url=callback_url,
            customer_email=request.user.email or f"user-{request.user.id}@corpcore.app",
            customer_firstname=request.user.first_name,
            customer_lastname=request.user.last_name or request.user.username,
            metadata={
                "tenant_id": str(tenant.id),
                "tenant_schema": getattr(tenant, "schema_name", ""),
                "module_ids": [str(module.id) for module in modules],
                "module_codes": module_codes,
                "module_months": months_by_module,
                "module_count": str(len(modules)),
                "total_amount_xof": str(total_amount),
            },
        )

        tx_id = extract_transaction_id(tx_payload)
        tx_status = extract_transaction_status(tx_payload)
        payment_url = get_transaction_payment_url(tx_id) if tx_id else None

        supported_statuses = dict(TenantSubscription.STATUS_CHOICES)
        saved_subscriptions = []
        for module in modules:
            subscription, _ = TenantSubscription.objects.get_or_create(
                tenant=tenant,
                module=module,
                defaults={"status": TenantSubscription.STATUS_PENDING},
            )
            subscription.status = tx_status if tx_status in supported_statuses else TenantSubscription.STATUS_PENDING
            subscription.fedapay_transaction_id = tx_id or ""
            subscription.metadata = {
                "transaction_payload": tx_payload,
                "bundle": True,
                "bundle_module_ids": [str(m.id) for m in modules],
                "bundle_module_codes": module_codes,
                "purchased_months": months_by_module.get(str(module.id), 1),
                "line_subtotal_xof": int(module.monthly_price_xof or 0) * int(months_by_module.get(str(module.id), 1)),
                "amount_xof_total": total_amount,
            }
            subscription.save()
            saved_subscriptions.append(subscription)

        return response.Response(
            {
                "subscription_ids": [str(sub.id) for sub in saved_subscriptions],
                "transaction_id": tx_id,
                "status": saved_subscriptions[0].status if saved_subscriptions else TenantSubscription.STATUS_PENDING,
                "module_count": len(modules),
                "module_codes": module_codes,
                "module_lines": module_lines,
                "total_amount_xof": total_amount,
                "payment_url": payment_url,
                "fedapay": tx_payload,
            },
            status=status.HTTP_201_CREATED,
        )


class SyncModulePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        tenant = getattr(request, "tenant", None)
        serializer = SyncModulePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tx_id = serializer.validated_data["transaction_id"]

        subscriptions = list(
            TenantSubscription.objects.filter(tenant=tenant, fedapay_transaction_id=str(tx_id))
            .select_related("module")
            .order_by("module__name")
        )
        if not subscriptions:
            return response.Response({"detail": "Transaction inconnue."}, status=status.HTTP_404_NOT_FOUND)

        payload = get_transaction(tx_id)
        tx_status = extract_transaction_status(payload).lower()

        status_map = {
            "pending": TenantSubscription.STATUS_PENDING,
            "approved": TenantSubscription.STATUS_ACTIVE,
            "transferred": TenantSubscription.STATUS_ACTIVE,
            "declined": TenantSubscription.STATUS_SUSPENDED,
            "expired": TenantSubscription.STATUS_SUSPENDED,
            "canceled": TenantSubscription.STATUS_CANCELLED,
            "cancelled": TenantSubscription.STATUS_CANCELLED,
            "refunded": TenantSubscription.STATUS_CANCELLED,
        }
        new_status = status_map.get(tx_status, TenantSubscription.STATUS_PENDING)
        now = timezone.now()
        for subscription in subscriptions:
            subscription.status = new_status
            if subscription.status == TenantSubscription.STATUS_ACTIVE:
                metadata = dict(subscription.metadata or {})
                purchased_months = int(metadata.get("purchased_months", 1) or 1)
                renewal_at = _compute_extended_renewal_at(subscription, now, purchased_months)
                subscription.started_at = subscription.started_at or now
                subscription.renewal_at = renewal_at
                subscription.grace_until = renewal_at + timedelta(days=3)
                metadata["trial"] = False
                metadata["last_sync_payload"] = payload
                metadata["activated_via_payment"] = True
                subscription.metadata = metadata
            else:
                subscription.metadata = {"last_sync_payload": payload}
            subscription.save()

        if new_status == TenantSubscription.STATUS_ACTIVE:
            tenant.on_trial = False
            max_renewal = (
                TenantSubscription.objects.filter(
                    tenant=tenant,
                    status__in=[TenantSubscription.STATUS_ACTIVE, TenantSubscription.STATUS_GRACE],
                    renewal_at__isnull=False,
                ).aggregate(max_renewal=Max("renewal_at"))["max_renewal"]
                or max([sub.renewal_at for sub in subscriptions if sub.renewal_at] or [now])
            )
            tenant.paid_until = max_renewal.date()
            tenant.save(update_fields=["on_trial", "paid_until"])

            recipient_email = resolve_billing_recipient_email(
                tenant=tenant,
                fallback_email=getattr(request.user, "email", None),
            )
            if recipient_email:
                to_notify = []
                for subscription in subscriptions:
                    metadata = dict(subscription.metadata or {})
                    if metadata.get("last_payment_success_notified_tx") == str(tx_id):
                        continue
                    metadata["last_payment_success_notified_tx"] = str(tx_id)
                    subscription.metadata = metadata
                    subscription.save(update_fields=["metadata", "updated_at"])
                    to_notify.append(subscription)
                if to_notify:
                    try:
                        send_payment_success_email(
                            tenant=tenant,
                            recipient_email=recipient_email,
                            subscriptions=to_notify,
                            transaction_id=str(tx_id),
                        )
                    except Exception:
                        logger.exception("Failed to send payment success email tx=%s tenant=%s", tx_id, tenant.id)
            try:
                first_metadata = dict((subscriptions[0].metadata or {})) if subscriptions else {}
                amount_xof = first_metadata.get("amount_xof_total") or 0
                module_codes = [sub.module.code for sub in subscriptions]
                record_billing_payment_to_finance(
                    transaction_id=str(tx_id),
                    amount_xof=amount_xof,
                    module_codes=module_codes,
                    owner_user=request.user,
                )
            except Exception:
                logger.exception("Failed to sync billing payment to finance tx=%s tenant=%s", tx_id, tenant.id)

        return response.Response(
            {
                "transaction_id": str(tx_id),
                "status": new_status,
                "tenant_on_trial": tenant.on_trial,
                "tenant_paid_until": tenant.paid_until.isoformat() if tenant.paid_until else None,
                "subscriptions": TenantSubscriptionSerializer(subscriptions, many=True).data,
            }
        )


class FedaPaySubscriptionWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        raw_payload = request.body.decode("utf-8") if isinstance(request.body, (bytes, bytearray)) else str(request.body)
        signature = request.headers.get("X-FEDAPAY-SIGNATURE") or request.headers.get("x-fedapay-signature")
        secret = settings.FEDAPAY_WEBHOOK_SECRET
        if secret:
            if not signature:
                return response.Response({"detail": "signature manquante"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                WebhookSignature.verify_header(raw_payload, signature, secret, tolerance=300)
            except Exception:
                return response.Response({"detail": "signature invalide"}, status=status.HTTP_400_BAD_REQUEST)

        event_payload = request.data if isinstance(request.data, dict) else {}
        tx_id = (
            event_payload.get("data", {}).get("id")
            or event_payload.get("data", {}).get("transaction", {}).get("id")
            or event_payload.get("transaction", {}).get("id")
            or event_payload.get("id")
        )
        if not tx_id:
            return response.Response({"received": True})

        subscriptions = list(TenantSubscription.objects.filter(fedapay_transaction_id=str(tx_id)).select_related("tenant", "module"))
        if not subscriptions:
            return response.Response({"received": True})

        payload = get_transaction(tx_id)
        tx_status = extract_transaction_status(payload).lower()
        now = timezone.now()
        if tx_status in {"approved", "transferred"}:
            new_status = TenantSubscription.STATUS_ACTIVE
        elif tx_status in {"declined", "expired"}:
            new_status = TenantSubscription.STATUS_SUSPENDED
        elif tx_status in {"refunded", "cancelled", "canceled"}:
            new_status = TenantSubscription.STATUS_CANCELLED
        else:
            new_status = TenantSubscription.STATUS_PENDING

        for subscription in subscriptions:
            subscription.status = new_status
            metadata = dict(subscription.metadata or {})
            metadata["webhook_payload"] = event_payload
            if new_status == TenantSubscription.STATUS_ACTIVE:
                purchased_months = int(metadata.get("purchased_months", 1) or 1)
                renewal_at = _compute_extended_renewal_at(subscription, now, purchased_months)
                metadata["trial"] = False
                subscription.started_at = subscription.started_at or now
                subscription.renewal_at = renewal_at
                subscription.grace_until = renewal_at + timedelta(days=3)
            subscription.metadata = metadata
            subscription.save()

        if new_status == TenantSubscription.STATUS_ACTIVE:
            tenant = subscriptions[0].tenant
            tenant.on_trial = False
            max_renewal = (
                TenantSubscription.objects.filter(
                    tenant=tenant,
                    status__in=[TenantSubscription.STATUS_ACTIVE, TenantSubscription.STATUS_GRACE],
                    renewal_at__isnull=False,
                ).aggregate(max_renewal=Max("renewal_at"))["max_renewal"]
                or max([sub.renewal_at for sub in subscriptions if sub.renewal_at] or [now])
            )
            tenant.paid_until = max_renewal.date()
            tenant.save(update_fields=["on_trial", "paid_until"])

            recipient_email = resolve_billing_recipient_email(tenant=tenant)
            if recipient_email:
                to_notify = []
                for subscription in subscriptions:
                    metadata = dict(subscription.metadata or {})
                    if metadata.get("last_payment_success_notified_tx") == str(tx_id):
                        continue
                    metadata["last_payment_success_notified_tx"] = str(tx_id)
                    subscription.metadata = metadata
                    subscription.save(update_fields=["metadata", "updated_at"])
                    to_notify.append(subscription)
                if to_notify:
                    try:
                        send_payment_success_email(
                            tenant=tenant,
                            recipient_email=recipient_email,
                            subscriptions=to_notify,
                            transaction_id=str(tx_id),
                        )
                    except Exception:
                        logger.exception("Failed to send payment success email from webhook tx=%s tenant=%s", tx_id, tenant.id)
            try:
                first_metadata = dict((subscriptions[0].metadata or {})) if subscriptions else {}
                amount_xof = first_metadata.get("amount_xof_total") or 0
                module_codes = [sub.module.code for sub in subscriptions]
                record_billing_payment_to_finance(
                    transaction_id=str(tx_id),
                    amount_xof=amount_xof,
                    module_codes=module_codes,
                    owner_user=None,
                )
            except Exception:
                logger.exception("Failed to sync billing webhook to finance tx=%s tenant=%s", tx_id, tenant.id)

        return response.Response({"received": True})
