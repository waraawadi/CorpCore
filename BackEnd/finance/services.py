from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import FinanceAccount, FinanceCategory, FinanceTransaction


def _resolve_finance_owner(fallback_user=None):
    if fallback_user and getattr(fallback_user, "is_authenticated", False):
        return fallback_user
    User = get_user_model()
    return User.objects.filter(is_active=True).order_by("id").first()


def _to_decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def record_billing_payment_to_finance(
    *,
    transaction_id: str,
    amount_xof,
    module_codes,
    owner_user=None,
    booked_on: date | None = None,
):
    owner = _resolve_finance_owner(owner_user)
    if not owner:
        return None

    reference = f"billing:{transaction_id}"
    if FinanceTransaction.objects.filter(reference=reference).exists():
        return None

    account, _ = FinanceAccount.objects.get_or_create(
        owner=owner,
        name="Compte Billing",
        defaults={
            "account_type": FinanceAccount.TYPE_BANK,
            "currency_code": "XOF",
            "opening_balance": Decimal("0"),
            "is_active": True,
        },
    )
    category, _ = FinanceCategory.objects.get_or_create(
        owner=owner,
        name="Abonnements modules",
        kind=FinanceCategory.KIND_INCOME,
        defaults={
            "color": "#0F6E56",
            "is_active": True,
        },
    )
    tx = FinanceTransaction.objects.create(
        title="Paiement modules Billing",
        transaction_type=FinanceTransaction.TYPE_INCOME,
        amount=_to_decimal(amount_xof),
        booked_on=booked_on or timezone.now().date(),
        notes=f"Modules: {', '.join(module_codes or [])}",
        reference=reference,
        account=account,
        category=category,
        owner=owner,
    )
    return tx

