import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class FinanceAccount(TimeStampedModel):
    TYPE_CASH = "cash"
    TYPE_BANK = "bank"
    TYPE_MOBILE = "mobile_money"

    TYPE_CHOICES = (
        (TYPE_CASH, "Cash"),
        (TYPE_BANK, "Bank"),
        (TYPE_MOBILE, "Mobile money"),
    )

    name = models.CharField(max_length=160)
    account_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_BANK)
    currency_code = models.CharField(max_length=3, default="XOF")
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    is_active = models.BooleanField(default=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_accounts")

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class FinanceCategory(TimeStampedModel):
    KIND_INCOME = "income"
    KIND_EXPENSE = "expense"

    KIND_CHOICES = (
        (KIND_INCOME, "Income"),
        (KIND_EXPENSE, "Expense"),
    )

    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=KIND_EXPENSE)
    color = models.CharField(max_length=20, blank=True, default="")
    is_active = models.BooleanField(default=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_categories")

    class Meta:
        ordering = ("kind", "name")
        constraints = [
            models.UniqueConstraint(fields=("name", "kind"), name="uniq_finance_category_name_kind"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.kind})"


class FinanceTransaction(TimeStampedModel):
    TYPE_INCOME = "income"
    TYPE_EXPENSE = "expense"
    TYPE_TRANSFER = "transfer"

    TYPE_CHOICES = (
        (TYPE_INCOME, "Income"),
        (TYPE_EXPENSE, "Expense"),
        (TYPE_TRANSFER, "Transfer"),
    )

    title = models.CharField(max_length=255)
    transaction_type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=TYPE_EXPENSE)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    booked_on = models.DateField()
    notes = models.TextField(blank=True, default="")
    reference = models.CharField(max_length=120, blank=True, default="")

    account = models.ForeignKey(FinanceAccount, on_delete=models.PROTECT, related_name="transactions")
    category = models.ForeignKey(
        FinanceCategory,
        on_delete=models.SET_NULL,
        related_name="transactions",
        null=True,
        blank=True,
    )
    transfer_account = models.ForeignKey(
        FinanceAccount,
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_transactions")

    class Meta:
        ordering = ("-booked_on", "-created_at")

    def __str__(self) -> str:
        return self.title


class FinanceInvoice(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_ISSUED = "issued"
    STATUS_PARTIAL = "partial"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_ISSUED, "Issued"),
        (STATUS_PARTIAL, "Partially paid"),
        (STATUS_PAID, "Paid"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    number = models.CharField(max_length=80, unique=True)
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True, default="")
    customer_phone = models.CharField(max_length=40, blank=True, default="")
    currency_code = models.CharField(max_length=3, default="XOF")
    issued_on = models.DateField()
    due_on = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True, default="")

    subtotal_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_invoices")

    class Meta:
        ordering = ("-issued_on", "-created_at")

    def __str__(self) -> str:
        return self.number


class FinanceInvoiceLine(TimeStampedModel):
    invoice = models.ForeignKey(FinanceInvoice, on_delete=models.CASCADE, related_name="lines")
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    category = models.ForeignKey(
        FinanceCategory,
        on_delete=models.SET_NULL,
        related_name="invoice_lines",
        null=True,
        blank=True,
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_invoice_lines")

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.invoice.number} - {self.description}"


class FinanceDocument(TimeStampedModel):
    TYPE_INVOICE = "invoice"
    TYPE_RECEIPT = "receipt"
    TYPE_PURCHASE = "purchase"
    TYPE_BANK_STATEMENT = "bank_statement"
    TYPE_PAYROLL = "payroll"
    TYPE_TAX = "tax"
    TYPE_MISC = "misc"

    TYPE_CHOICES = (
        (TYPE_INVOICE, "Invoice"),
        (TYPE_RECEIPT, "Receipt"),
        (TYPE_PURCHASE, "Purchase"),
        (TYPE_BANK_STATEMENT, "Bank statement"),
        (TYPE_PAYROLL, "Payroll"),
        (TYPE_TAX, "Tax"),
        (TYPE_MISC, "Misc"),
    )

    REPORT_BALANCE_SHEET = "balance_sheet"
    REPORT_INCOME_STATEMENT = "income_statement"
    REPORT_CASHFLOW = "cashflow"
    REPORT_TAX = "tax"
    REPORT_AUDIT = "audit"
    REPORT_MISC = "misc"

    REPORT_CHOICES = (
        (REPORT_BALANCE_SHEET, "Balance sheet"),
        (REPORT_INCOME_STATEMENT, "Income statement"),
        (REPORT_CASHFLOW, "Cashflow"),
        (REPORT_TAX, "Tax"),
        (REPORT_AUDIT, "Audit"),
        (REPORT_MISC, "Misc"),
    )

    title = models.CharField(max_length=255)
    document_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_MISC)
    report_scope = models.CharField(max_length=32, choices=REPORT_CHOICES, default=REPORT_MISC)
    document_date = models.DateField()
    reference = models.CharField(max_length=120, blank=True, default="")
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    currency_code = models.CharField(max_length=3, default="XOF")
    description = models.TextField(blank=True, default="")
    source_url = models.URLField(blank=True, default="")

    account = models.ForeignKey(FinanceAccount, on_delete=models.SET_NULL, related_name="documents", null=True, blank=True)
    category = models.ForeignKey(FinanceCategory, on_delete=models.SET_NULL, related_name="documents", null=True, blank=True)
    transaction = models.ForeignKey(
        FinanceTransaction, on_delete=models.SET_NULL, related_name="documents", null=True, blank=True
    )
    invoice = models.ForeignKey(FinanceInvoice, on_delete=models.SET_NULL, related_name="documents", null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="finance_documents")

    class Meta:
        ordering = ("-document_date", "-created_at")

    def __str__(self) -> str:
        return self.title

