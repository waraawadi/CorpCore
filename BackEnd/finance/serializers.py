from decimal import Decimal

from rest_framework import serializers

from .models import (
    FinanceAccount,
    FinanceCategory,
    FinanceDocument,
    FinanceInvoice,
    FinanceInvoiceLine,
    FinanceTransaction,
)


class FinanceAccountSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinanceAccount
        fields = (
            "id",
            "name",
            "account_type",
            "currency_code",
            "opening_balance",
            "is_active",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def validate_currency_code(self, value: str) -> str:
        code = (value or "").strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise serializers.ValidationError("Devise invalide (code ISO 3 lettres).")
        return code


class FinanceCategorySerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinanceCategory
        fields = (
            "id",
            "name",
            "kind",
            "color",
            "is_active",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")


class FinanceTransactionSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    account = serializers.PrimaryKeyRelatedField(queryset=FinanceAccount.objects.all())
    category = serializers.PrimaryKeyRelatedField(queryset=FinanceCategory.objects.all(), allow_null=True, required=False)
    transfer_account = serializers.PrimaryKeyRelatedField(
        queryset=FinanceAccount.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = FinanceTransaction
        fields = (
            "id",
            "title",
            "transaction_type",
            "amount",
            "booked_on",
            "notes",
            "reference",
            "account",
            "category",
            "transfer_account",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def validate_amount(self, value):
        if value is None:
            raise serializers.ValidationError("Montant requis.")
        if Decimal(value) <= Decimal("0"):
            raise serializers.ValidationError("Le montant doit etre superieur a 0.")
        return value

    def validate(self, attrs):
        tx_type = attrs.get("transaction_type")
        account = attrs.get("account")
        transfer_account = attrs.get("transfer_account")

        if self.instance:
            tx_type = attrs.get("transaction_type", self.instance.transaction_type)
            account = attrs.get("account", self.instance.account)
            transfer_account = attrs.get("transfer_account", self.instance.transfer_account)

        if tx_type == FinanceTransaction.TYPE_TRANSFER:
            if not transfer_account:
                raise serializers.ValidationError({"transfer_account": "Compte destinataire requis pour un transfert."})
            if account and transfer_account and account.id == transfer_account.id:
                raise serializers.ValidationError({"transfer_account": "Le compte destinataire doit etre different."})
        else:
            if transfer_account is not None:
                raise serializers.ValidationError({"transfer_account": "Autorise uniquement pour les transferts."})

        return attrs


class FinanceInvoiceLineSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinanceInvoiceLine
        fields = (
            "id",
            "invoice",
            "description",
            "quantity",
            "unit_price",
            "tax_rate",
            "line_total",
            "category",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def validate(self, attrs):
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", Decimal("0")))
        unit_price = attrs.get("unit_price", getattr(self.instance, "unit_price", Decimal("0")))
        tax_rate = attrs.get("tax_rate", getattr(self.instance, "tax_rate", Decimal("0")))
        if Decimal(quantity) <= Decimal("0"):
            raise serializers.ValidationError({"quantity": "La quantite doit etre superieure a 0."})
        if Decimal(unit_price) < Decimal("0"):
            raise serializers.ValidationError({"unit_price": "Le prix unitaire doit etre positif."})
        if Decimal(tax_rate) < Decimal("0"):
            raise serializers.ValidationError({"tax_rate": "Le taux de taxe doit etre positif."})

        subtotal = Decimal(quantity) * Decimal(unit_price)
        total = subtotal + (subtotal * Decimal(tax_rate) / Decimal("100"))
        attrs["line_total"] = total.quantize(Decimal("0.01"))
        return attrs


class FinanceInvoiceSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    lines = FinanceInvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = FinanceInvoice
        fields = (
            "id",
            "number",
            "customer_name",
            "customer_email",
            "customer_phone",
            "currency_code",
            "issued_on",
            "due_on",
            "status",
            "notes",
            "subtotal_amount",
            "tax_amount",
            "total_amount",
            "paid_amount",
            "owner",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "subtotal_amount", "tax_amount", "total_amount", "created_at", "updated_at")

    def validate_currency_code(self, value: str) -> str:
        code = (value or "").strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise serializers.ValidationError("Devise invalide (code ISO 3 lettres).")
        return code

    def validate_paid_amount(self, value):
        if Decimal(value) < Decimal("0"):
            raise serializers.ValidationError("Le montant paye doit etre positif.")
        return value


class FinanceDocumentSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FinanceDocument
        fields = (
            "id",
            "title",
            "document_type",
            "report_scope",
            "document_date",
            "reference",
            "amount",
            "currency_code",
            "description",
            "source_url",
            "account",
            "category",
            "transaction",
            "invoice",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def validate_currency_code(self, value: str) -> str:
        code = (value or "").strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise serializers.ValidationError("Devise invalide (code ISO 3 lettres).")
        return code

