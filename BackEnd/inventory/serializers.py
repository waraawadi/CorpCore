import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import InventoryAssetReference, InventoryCategory, InventoryItem, InventoryLocation, InventoryMovement

User = get_user_model()


def movement_effect(movement_type: str, quantity: Decimal) -> Decimal:
    if movement_type == InventoryMovement.TYPE_OUT:
        return -quantity
    return quantity


def _quantity_to_units(quantity: Decimal) -> int:
    normalized = quantity.copy_abs()
    if normalized != normalized.to_integral_value():
        raise serializers.ValidationError({"quantity": "La quantite doit etre un nombre entier pour le suivi par serie."})
    return int(normalized)


def _generate_serial_number(item: InventoryItem, movement: InventoryMovement, index: int) -> str:
    prefix = (movement.reference or "").strip() or item.sku
    return f"{prefix}-{timezone.now():%y%m%d}-{index:03d}-{uuid.uuid4().hex[:6].upper()}"


def _create_asset_references_for_entry(movement: InventoryMovement):
    units = _quantity_to_units(movement.quantity)
    refs = []
    for idx in range(1, units + 1):
        refs.append(
            InventoryAssetReference(
                item=movement.item,
                serial_number=_generate_serial_number(movement.item, movement, idx),
                source_movement_in=movement,
                location=movement.location,
                status=InventoryAssetReference.STATUS_IN_STOCK,
            )
        )
    InventoryAssetReference.objects.bulk_create(refs)


def _consume_asset_references_for_output(movement: InventoryMovement, *, units: int | None = None):
    units_to_consume = units or _quantity_to_units(movement.quantity)
    available_refs = (
        InventoryAssetReference.objects.select_for_update()
        .filter(item=movement.item)
        .exclude(status=InventoryAssetReference.STATUS_OUT)
        .order_by("created_at")
    )
    selected_refs = list(available_refs[:units_to_consume])
    if len(selected_refs) < units_to_consume:
        raise serializers.ValidationError({"quantity": "References insuffisantes pour cette sortie."})
    for ref in selected_refs:
        ref.status = InventoryAssetReference.STATUS_OUT
        ref.source_movement_out = movement
        ref.assigned_to = None
        ref.assigned_at = None
        ref.location = movement.location
    InventoryAssetReference.objects.bulk_update(
        selected_refs,
        ["status", "source_movement_out", "assigned_to", "assigned_at", "location", "updated_at"],
    )


def sync_asset_references_on_movement_create(movement: InventoryMovement):
    if movement.movement_type == InventoryMovement.TYPE_IN:
        _create_asset_references_for_entry(movement)
        return
    if movement.movement_type == InventoryMovement.TYPE_OUT:
        _consume_asset_references_for_output(movement)
        return
    # Adjustment: positive = entree, negative = sortie
    if movement.quantity > 0:
        _create_asset_references_for_entry(movement)
    else:
        _consume_asset_references_for_output(movement, units=_quantity_to_units(movement.quantity))


class InventoryCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCategory
        fields = ("id", "name", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class InventoryLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryLocation
        fields = ("id", "name", "code", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class InventoryItemSerializer(serializers.ModelSerializer):
    categoryId = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=InventoryCategory.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    categoryName = serializers.SerializerMethodField()
    quantityOnHand = serializers.DecimalField(source="quantity_on_hand", max_digits=14, decimal_places=3, read_only=True)
    reorderLevel = serializers.DecimalField(source="reorder_level", max_digits=14, decimal_places=3)
    costPrice = serializers.DecimalField(source="cost_price", max_digits=14, decimal_places=2, allow_null=True, required=False)
    sellingPrice = serializers.DecimalField(source="selling_price", max_digits=14, decimal_places=2, allow_null=True, required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "name",
            "sku",
            "description",
            "categoryId",
            "categoryName",
            "unit",
            "quantityOnHand",
            "reorderLevel",
            "costPrice",
            "sellingPrice",
            "isActive",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "categoryName", "quantityOnHand")

    def get_categoryName(self, obj):
        return obj.category.name if obj.category_id else ""


class InventoryMovementSerializer(serializers.ModelSerializer):
    itemId = serializers.PrimaryKeyRelatedField(source="item", queryset=InventoryItem.objects.filter(is_active=True))
    itemName = serializers.SerializerMethodField()
    itemSku = serializers.SerializerMethodField()
    locationId = serializers.PrimaryKeyRelatedField(
        source="location",
        queryset=InventoryLocation.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    locationName = serializers.SerializerMethodField()
    movementType = serializers.CharField(source="movement_type")
    movedByName = serializers.SerializerMethodField()

    class Meta:
        model = InventoryMovement
        fields = (
            "id",
            "itemId",
            "itemName",
            "itemSku",
            "locationId",
            "locationName",
            "movementType",
            "quantity",
            "unit_cost",
            "reference",
            "note",
            "occurred_at",
            "movedByName",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "itemName", "itemSku", "locationName", "movedByName")

    def validate(self, attrs):
        movement_type = attrs.get("movement_type", getattr(self.instance, "movement_type", ""))
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))

        if quantity is None:
            raise serializers.ValidationError({"quantity": "La quantite est obligatoire."})

        if movement_type in (InventoryMovement.TYPE_IN, InventoryMovement.TYPE_OUT) and quantity <= 0:
            raise serializers.ValidationError({"quantity": "La quantite doit etre positive pour entree/sortie."})

        if movement_type == InventoryMovement.TYPE_ADJUSTMENT and quantity == 0:
            raise serializers.ValidationError({"quantity": "L'ajustement ne peut pas etre nul."})

        _quantity_to_units(quantity)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        item = InventoryItem.objects.select_for_update().get(pk=validated_data["item"].pk)
        qty_effect = movement_effect(validated_data["movement_type"], validated_data["quantity"])
        resulting_qty = item.quantity_on_hand + qty_effect
        if resulting_qty < Decimal("0"):
            raise serializers.ValidationError({"quantity": "Le stock resultant ne peut pas etre negatif."})
        item.quantity_on_hand = resulting_qty
        item.save(update_fields=["quantity_on_hand", "updated_at"])
        validated_data["item"] = item
        movement = super().create(validated_data)
        sync_asset_references_on_movement_create(movement)
        return movement

    @transaction.atomic
    def update(self, instance, validated_data):
        stock_affecting_change = (
            ("item" in validated_data and validated_data["item"].pk != instance.item_id)
            or ("movement_type" in validated_data and validated_data["movement_type"] != instance.movement_type)
            or ("quantity" in validated_data and validated_data["quantity"] != instance.quantity)
        )
        if stock_affecting_change and (instance.created_references.exists() or instance.output_references.exists()):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Modification du type/article/quantite interdite pour ce mouvement. "
                        "Supprimez puis recreez le mouvement."
                    )
                }
            )
        if not stock_affecting_change:
            return super().update(instance, validated_data)

        old_item = InventoryItem.objects.select_for_update().get(pk=instance.item_id)
        new_item_ref = validated_data.get("item", instance.item)
        new_item = old_item if new_item_ref.pk == old_item.pk else InventoryItem.objects.select_for_update().get(pk=new_item_ref.pk)

        old_effect = movement_effect(instance.movement_type, instance.quantity)
        new_type = validated_data.get("movement_type", instance.movement_type)
        new_quantity = validated_data.get("quantity", instance.quantity)
        new_effect = movement_effect(new_type, new_quantity)

        if old_item.pk == new_item.pk:
            resulting_qty = old_item.quantity_on_hand - old_effect + new_effect
            if resulting_qty < Decimal("0"):
                raise serializers.ValidationError({"quantity": "Le stock resultant ne peut pas etre negatif."})
            old_item.quantity_on_hand = resulting_qty
            old_item.save(update_fields=["quantity_on_hand", "updated_at"])
        else:
            old_resulting_qty = old_item.quantity_on_hand - old_effect
            new_resulting_qty = new_item.quantity_on_hand + new_effect
            if old_resulting_qty < Decimal("0") or new_resulting_qty < Decimal("0"):
                raise serializers.ValidationError({"quantity": "Le stock resultant ne peut pas etre negatif."})
            old_item.quantity_on_hand = old_resulting_qty
            new_item.quantity_on_hand = new_resulting_qty
            old_item.save(update_fields=["quantity_on_hand", "updated_at"])
            new_item.save(update_fields=["quantity_on_hand", "updated_at"])

        validated_data["item"] = new_item
        return super().update(instance, validated_data)

    def get_itemName(self, obj):
        return obj.item.name

    def get_itemSku(self, obj):
        return obj.item.sku

    def get_locationName(self, obj):
        return obj.location.name if obj.location_id else ""

    def get_movedByName(self, obj):
        if not obj.moved_by:
            return ""
        return obj.moved_by.get_full_name() or obj.moved_by.username or obj.moved_by.email


class InventoryAssetReferenceSerializer(serializers.ModelSerializer):
    itemId = serializers.UUIDField(source="item_id", read_only=True)
    itemName = serializers.SerializerMethodField()
    itemSku = serializers.SerializerMethodField()
    categoryId = serializers.UUIDField(source="item.category_id", read_only=True)
    categoryName = serializers.SerializerMethodField()
    locationName = serializers.SerializerMethodField()
    assignedTo = serializers.IntegerField(source="assigned_to_id", read_only=True)
    assignedToName = serializers.SerializerMethodField()
    serialNumber = serializers.CharField(source="serial_number")
    sourceMovementInId = serializers.UUIDField(source="source_movement_in_id", read_only=True)
    sourceMovementOutId = serializers.UUIDField(source="source_movement_out_id", read_only=True)

    class Meta:
        model = InventoryAssetReference
        fields = (
            "id",
            "serialNumber",
            "status",
            "itemId",
            "itemName",
            "itemSku",
            "categoryId",
            "categoryName",
            "locationName",
            "assignedTo",
            "assignedToName",
            "assigned_at",
            "note",
            "sourceMovementInId",
            "sourceMovementOutId",
            "created_at",
            "updated_at",
        )

    def get_itemName(self, obj):
        return obj.item.name

    def get_itemSku(self, obj):
        return obj.item.sku

    def get_categoryName(self, obj):
        return obj.item.category.name if obj.item.category_id else ""

    def get_locationName(self, obj):
        return obj.location.name if obj.location_id else ""

    def get_assignedToName(self, obj):
        if not obj.assigned_to:
            return ""
        return obj.assigned_to.get_full_name() or obj.assigned_to.username or obj.assigned_to.email


class InventoryAssetAssignmentSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True, min_value=1)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate_user_id(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Utilisateur introuvable.")
        return value
