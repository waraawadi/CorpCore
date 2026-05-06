import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FinanceAccount",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("account_type", models.CharField(choices=[("cash", "Cash"), ("bank", "Bank"), ("mobile_money", "Mobile money")], default="bank", max_length=32)),
                ("currency_code", models.CharField(default="XOF", max_length=3)),
                ("opening_balance", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("is_active", models.BooleanField(default=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="finance_accounts", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("name",)},
        ),
        migrations.CreateModel(
            name="FinanceCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("kind", models.CharField(choices=[("income", "Income"), ("expense", "Expense")], default="expense", max_length=16)),
                ("color", models.CharField(blank=True, default="", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="finance_categories", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("kind", "name")},
        ),
        migrations.CreateModel(
            name="FinanceTransaction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                ("transaction_type", models.CharField(choices=[("income", "Income"), ("expense", "Expense"), ("transfer", "Transfer")], default="expense", max_length=16)),
                ("amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("booked_on", models.DateField()),
                ("notes", models.TextField(blank=True, default="")),
                ("reference", models.CharField(blank=True, default="", max_length=120)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transactions", to="finance.financeaccount")),
                ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="transactions", to="finance.financecategory")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="finance_transactions", to=settings.AUTH_USER_MODEL)),
                ("transfer_account", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="incoming_transfers", to="finance.financeaccount")),
            ],
            options={"ordering": ("-booked_on", "-created_at")},
        ),
        migrations.AddConstraint(
            model_name="financecategory",
            constraint=models.UniqueConstraint(fields=("name", "kind"), name="uniq_finance_category_name_kind"),
        ),
    ]

