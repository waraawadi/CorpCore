from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    ProcurementPurchaseOrder,
    ProcurementPurchaseOrderLine,
    ProcurementPurchaseRequest,
    ProcurementPurchaseRequestLine,
    ProcurementSupplier,
)


class ProcurementSupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementSupplier
        fields = (
            "id",
            "name",
            "company",
            "email",
            "phone",
            "city",
            "country",
            "address",
            "tax_id",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ProcurementPurchaseRequestLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementPurchaseRequestLine
        fields = (
            "id",
            "request",
            "description",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("line_total", "created_at", "updated_at")

    def validate_quantity(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("La quantite doit etre strictement positive.")
        return value


class ProcurementPurchaseRequestSerializer(serializers.ModelSerializer):
    lines = ProcurementPurchaseRequestLineSerializer(many=True, read_only=True)
    requested_by_label = serializers.SerializerMethodField()
    eligible_for_purchase_order = serializers.SerializerMethodField()
    linked_purchase_order_id = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementPurchaseRequest
        fields = (
            "id",
            "reference",
            "title",
            "status",
            "notes",
            "requested_by",
            "requested_by_label",
            "eligible_for_purchase_order",
            "linked_purchase_order_id",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "reference",
            "requested_by",
            "requested_by_label",
            "eligible_for_purchase_order",
            "linked_purchase_order_id",
            "lines",
            "created_at",
            "updated_at",
        )

    def get_requested_by_label(self, obj):
        user = obj.requested_by
        if not user:
            return ""
        name = (user.get_full_name() or getattr(user, "username", "") or "").strip()
        email = (getattr(user, "email", None) or "").strip()
        if name and email:
            return f"{name} ({email})"
        return name or email

    def get_eligible_for_purchase_order(self, obj):
        return obj.can_be_linked_to_new_purchase_order()

    def get_linked_purchase_order_id(self, obj):
        po = obj.generated_orders.only("id").first()
        return str(po.pk) if po else None

    def create(self, validated_data):
        validated_data["requested_by"] = self.context["request"].user
        return super().create(validated_data)


class ProcurementPurchaseOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementPurchaseOrderLine
        fields = (
            "id",
            "order",
            "description",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("line_total", "created_at", "updated_at")

    def validate_quantity(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("La quantite doit etre strictement positive.")
        return value


class ProcurementPurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()
    lines = ProcurementPurchaseOrderLineSerializer(many=True, read_only=True)
    source_request_reference = serializers.SerializerMethodField()
    import_request_lines = serializers.BooleanField(write_only=True, required=False, default=True)

    class Meta:
        model = ProcurementPurchaseOrder
        fields = (
            "id",
            "reference",
            "supplier",
            "supplier_name",
            "status",
            "notes",
            "expected_delivery",
            "total_amount",
            "source_request",
            "source_request_reference",
            "import_request_lines",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "reference",
            "total_amount",
            "supplier_name",
            "source_request_reference",
            "lines",
            "created_at",
            "updated_at",
        )

    def validate_source_request(self, value):
        if value is None:
            return value
        if self.instance and self.instance.source_request_id == value.pk:
            return value
        if value.status != ProcurementPurchaseRequest.STATUS_APPROVED:
            raise serializers.ValidationError(
                "Seule une demande au statut « Approuvee » peut etre liee a un bon de commande."
            )
        qs = value.generated_orders.all()
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Cette demande est deja liee a un autre bon de commande. Une demande approuvee ne peut alimenter qu'un seul BC."
            )
        return value

    @staticmethod
    def _sync_lines_from_request(order, request_obj):
        ProcurementPurchaseOrderLine.objects.filter(order=order).delete()
        order.recompute_total()
        for line in request_obj.lines.order_by("created_at"):
            ProcurementPurchaseOrderLine.objects.create(
                order=order,
                description=line.description[:255],
                quantity=line.quantity,
                unit_price=line.unit_price,
            )

    @staticmethod
    def _mark_request_fulfilled(request_obj):
        if request_obj.status == ProcurementPurchaseRequest.STATUS_APPROVED:
            request_obj.status = ProcurementPurchaseRequest.STATUS_FULFILLED
            request_obj.save(update_fields=["status", "updated_at"])

    @staticmethod
    def _maybe_revert_linked_request(request_obj):
        """Si plus aucun BC ne reference la demande, repasse de Transformee a Approuvee."""
        if request_obj.status != ProcurementPurchaseRequest.STATUS_FULFILLED:
            return
        if request_obj.generated_orders.exists():
            return
        request_obj.status = ProcurementPurchaseRequest.STATUS_APPROVED
        request_obj.save(update_fields=["status", "updated_at"])

    def create(self, validated_data):
        import_lines = validated_data.pop("import_request_lines", True)
        with transaction.atomic():
            order = super().create(validated_data)
            new_src = order.source_request
            if new_src and import_lines:
                self._sync_lines_from_request(order, new_src)
            if new_src:
                self._mark_request_fulfilled(new_src)
        return order

    def update(self, instance, validated_data):
        import_lines = validated_data.pop("import_request_lines", True)
        old_src = instance.source_request
        with transaction.atomic():
            order = super().update(instance, validated_data)
            new_src = order.source_request
            old_pk = old_src.pk if old_src else None
            new_pk = new_src.pk if new_src else None
            if old_pk != new_pk:
                if old_src:
                    self._maybe_revert_linked_request(old_src)
                if new_src and import_lines:
                    self._sync_lines_from_request(order, new_src)
                if new_src:
                    self._mark_request_fulfilled(new_src)
        return order

    def get_supplier_name(self, obj):
        return obj.supplier.name if obj.supplier_id else ""

    def get_source_request_reference(self, obj):
        return obj.source_request.reference if obj.source_request_id else ""
