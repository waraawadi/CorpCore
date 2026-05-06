import django.db.models.deletion
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinanceInvoice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("number", models.CharField(max_length=80, unique=True)),
                ("customer_name", models.CharField(max_length=255)),
                ("customer_email", models.EmailField(blank=True, default="", max_length=254)),
                ("customer_phone", models.CharField(blank=True, default="", max_length=40)),
                ("currency_code", models.CharField(default="XOF", max_length=3)),
                ("issued_on", models.DateField()),
                ("due_on", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("issued", "Issued"),
                            ("partial", "Partially paid"),
                            ("paid", "Paid"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("subtotal_amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("tax_amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("total_amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("paid_amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="finance_invoices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("-issued_on", "-created_at")},
        ),
        migrations.CreateModel(
            name="FinanceInvoiceLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("description", models.CharField(max_length=255)),
                ("quantity", models.DecimalField(decimal_places=2, default=Decimal("1"), max_digits=12)),
                ("unit_price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("tax_rate", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=5)),
                ("line_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="invoice_lines",
                        to="finance.financecategory",
                    ),
                ),
                (
                    "invoice",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="finance.financeinvoice",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="finance_invoice_lines",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.CreateModel(
            name="FinanceDocument",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                (
                    "document_type",
                    models.CharField(
                        choices=[
                            ("invoice", "Invoice"),
                            ("receipt", "Receipt"),
                            ("purchase", "Purchase"),
                            ("bank_statement", "Bank statement"),
                            ("payroll", "Payroll"),
                            ("tax", "Tax"),
                            ("misc", "Misc"),
                        ],
                        default="misc",
                        max_length=32,
                    ),
                ),
                (
                    "report_scope",
                    models.CharField(
                        choices=[
                            ("balance_sheet", "Balance sheet"),
                            ("income_statement", "Income statement"),
                            ("cashflow", "Cashflow"),
                            ("tax", "Tax"),
                            ("audit", "Audit"),
                            ("misc", "Misc"),
                        ],
                        default="misc",
                        max_length=32,
                    ),
                ),
                ("document_date", models.DateField()),
                ("reference", models.CharField(blank=True, default="", max_length=120)),
                ("amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("currency_code", models.CharField(default="XOF", max_length=3)),
                ("description", models.TextField(blank=True, default="")),
                ("source_url", models.URLField(blank=True, default="")),
                (
                    "account",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="documents",
                        to="finance.financeaccount",
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="documents",
                        to="finance.financecategory",
                    ),
                ),
                (
                    "invoice",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="documents",
                        to="finance.financeinvoice",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="finance_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "transaction",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="documents",
                        to="finance.financetransaction",
                    ),
                ),
            ],
            options={"ordering": ("-document_date", "-created_at")},
        ),
    ]
