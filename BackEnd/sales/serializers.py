from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import SalesCustomer, SalesOrder, SalesOrderLine, SalesProduct, SalesStockMovement


class SalesCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesCustomer
        fields = (
            "id",
            "name",
            "company",
            "email",
            "phone",
            "city",
            "country",
            "tax_id",
            "address",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class SalesProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesProduct
        fields = (
            "id",
            "name",
            "sku",
            "description",
            "unit_price",
            "stock_quantity",
            "reorder_level",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        stock = attrs.get("stock_quantity", getattr(instance, "stock_quantity", Decimal("0")))
        if stock < Decimal("0"):
            raise serializers.ValidationError({"stock_quantity": "Le stock ne peut pas etre negatif."})
        return attrs


class SalesOrderLineSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderLine
        fields = (
            "id",
            "order",
            "product",
            "product_name",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("line_total", "product_name", "created_at", "updated_at")

    def validate_quantity(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("La quantite doit etre strictement positive.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        product = attrs.get("product", getattr(self.instance, "product", None))
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", Decimal("0")))
        order = attrs.get("order", getattr(self.instance, "order", None))
        if product and quantity and order:
            # Verifie le stock global du produit en tenant compte des autres lignes
            # de la meme commande (brouillon ou confirmee).
            siblings = SalesOrderLine.objects.filter(order=order, product=product)
            if self.instance:
                siblings = siblings.exclude(pk=self.instance.pk)
            reserved_by_order = siblings.aggregate(total=Sum("quantity")).get("total") or Decimal("0")
            available_for_line = (product.stock_quantity or Decimal("0")) - reserved_by_order
            if quantity > available_for_line:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            f"Stock insuffisant pour ce produit. "
                            f"Disponible: {available_for_line}, demande: {quantity}."
                        )
                    }
                )
        return attrs

    def get_product_name(self, obj):
        return obj.product.name


class SalesOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    invoice_status = serializers.SerializerMethodField()
    invoice_document_title = serializers.SerializerMethodField()
    lines = SalesOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = SalesOrder
        fields = (
            "id",
            "reference",
            "customer",
            "customer_name",
            "status",
            "ordered_at",
            "notes",
            "total_amount",
            "invoice",
            "invoice_number",
            "invoice_status",
            "invoice_document",
            "invoice_document_title",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "reference",
            "total_amount",
            "invoice",
            "invoice_number",
            "invoice_status",
            "invoice_document",
            "invoice_document_title",
            "lines",
            "customer_name",
            "created_at",
            "updated_at",
        )

    def get_customer_name(self, obj):
        return obj.customer.name

    def get_invoice_number(self, obj):
        return obj.invoice.number if obj.invoice else ""

    def get_invoice_status(self, obj):
        return obj.invoice.status if obj.invoice else ""

    def get_invoice_document_title(self, obj):
        return obj.invoice_document.title if obj.invoice_document else ""


class SalesStockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_sku = serializers.SerializerMethodField()

    class Meta:
        model = SalesStockMovement
        fields = (
            "id",
            "product",
            "product_name",
            "product_sku",
            "movement_type",
            "quantity",
            "note",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("product_name", "product_sku", "created_at", "updated_at")

    def validate_quantity(self, value):
        if value == Decimal("0"):
            raise serializers.ValidationError("La quantite ne peut pas etre nulle.")
        return value

    def create(self, validated_data):
        product = validated_data["product"]
        quantity = validated_data["quantity"]
        movement_type = validated_data["movement_type"]
        current = product.stock_quantity or Decimal("0")
        if movement_type == SalesStockMovement.TYPE_OUT:
            projected = current - quantity
            if projected < Decimal("0"):
                raise serializers.ValidationError({"quantity": "Stock insuffisant."})
        elif movement_type == SalesStockMovement.TYPE_IN:
            projected = current + quantity
        else:
            projected = current + quantity
            if projected < Decimal("0"):
                raise serializers.ValidationError({"quantity": "Le stock ne peut pas devenir negatif."})
        movement = super().create(validated_data)
        product.stock_quantity = projected
        product.save(update_fields=["stock_quantity", "updated_at"])
        return movement

    def get_product_name(self, obj):
        return obj.product.name

    def get_product_sku(self, obj):
        return obj.product.sku
