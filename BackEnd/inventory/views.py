from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import decorators, permissions, response, viewsets
from rest_framework.exceptions import ValidationError

from .models import InventoryAssetReference, InventoryCategory, InventoryItem, InventoryLocation, InventoryMovement
from .serializers import (
    InventoryAssetAssignmentSerializer,
    InventoryAssetReferenceSerializer,
    InventoryCategorySerializer,
    InventoryItemSerializer,
    InventoryLocationSerializer,
    InventoryMovementSerializer,
    movement_effect,
)

User = get_user_model()


class InventoryCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = InventoryCategory.objects.all()


class InventoryLocationViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryLocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = InventoryLocation.objects.all()


class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = InventoryItem.objects.select_related("category").all()
        search = (self.request.query_params.get("search") or "").strip()
        category_id = (self.request.query_params.get("category") or "").strip()
        low_stock = (self.request.query_params.get("low_stock") or "").strip().lower()

        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if low_stock in {"1", "true", "yes"}:
            queryset = queryset.filter(quantity_on_hand__lte=models.F("reorder_level"))
        return queryset

    @decorators.action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        queryset = (
            self.get_queryset()
            .filter(is_active=True)
            .filter(quantity_on_hand__lte=models.F("reorder_level"))
            .order_by("quantity_on_hand", "name")
        )
        serializer = self.get_serializer(queryset, many=True)
        return response.Response(serializer.data)

    @decorators.action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        low_stock_count = queryset.filter(quantity_on_hand__lte=models.F("reorder_level"), is_active=True).count()
        total_quantity = queryset.aggregate(total_qty=Sum("quantity_on_hand")).get("total_qty") or 0
        return response.Response(
            {
                "itemsCount": queryset.count(),
                "activeItemsCount": queryset.filter(is_active=True).count(),
                "lowStockCount": low_stock_count,
                "totalQuantity": total_quantity,
            }
        )


class InventoryMovementViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryMovementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = InventoryMovement.objects.select_related("item", "location", "moved_by").all()
        item_id = (self.request.query_params.get("item") or "").strip()
        location_id = (self.request.query_params.get("location") or "").strip()
        movement_type = (self.request.query_params.get("type") or "").strip()
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        if location_id:
            queryset = queryset.filter(location_id=location_id)
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)
        return queryset

    def perform_create(self, serializer):
        serializer.save(moved_by=self.request.user)

    @transaction.atomic
    def perform_destroy(self, instance):
        refs_from_entry = list(instance.created_references.select_for_update())
        if refs_from_entry:
            if any(ref.status != InventoryAssetReference.STATUS_IN_STOCK for ref in refs_from_entry):
                raise ValidationError(
                    {
                        "detail": (
                            "Suppression impossible: certaines references de cette entree sont deja affectees ou sorties."
                        )
                    }
                )
            InventoryAssetReference.objects.filter(id__in=[ref.id for ref in refs_from_entry]).delete()

        output_refs = list(instance.output_references.select_for_update())
        for ref in output_refs:
            ref.status = InventoryAssetReference.STATUS_IN_STOCK
            ref.source_movement_out = None
            ref.location = instance.location
        if output_refs:
            InventoryAssetReference.objects.bulk_update(output_refs, ["status", "source_movement_out", "location", "updated_at"])

        item = InventoryItem.objects.select_for_update().get(pk=instance.item_id)
        reversed_qty = item.quantity_on_hand - movement_effect(instance.movement_type, instance.quantity)
        if reversed_qty < Decimal("0"):
            raise ValidationError({"detail": "Suppression impossible: stock resultant negatif."})
        item.quantity_on_hand = reversed_qty
        item.save(update_fields=["quantity_on_hand", "updated_at"])
        instance.delete()


class InventoryAssetReferenceViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryAssetReferenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        queryset = InventoryAssetReference.objects.select_related("item__category", "location", "assigned_to")
        category_id = (self.request.query_params.get("category") or "").strip()
        item_id = (self.request.query_params.get("item") or "").strip()
        status_value = (self.request.query_params.get("status") or "").strip()
        assigned_to = (self.request.query_params.get("assigned_to") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if category_id:
            queryset = queryset.filter(item__category_id=category_id)
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if search:
            queryset = queryset.filter(Q(serial_number__icontains=search) | Q(item__name__icontains=search) | Q(item__sku__icontains=search))
        return queryset

    @decorators.action(detail=True, methods=["post"])
    @transaction.atomic
    def assign(self, request, pk=None):
        asset = self.get_object()
        if asset.status == InventoryAssetReference.STATUS_OUT:
            raise ValidationError({"detail": "Reference deja sortie du stock."})
        payload = InventoryAssetAssignmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user = get_object_or_404(User, id=payload.validated_data["user_id"])
        asset.assigned_to = user
        asset.assigned_at = timezone.now()
        asset.status = InventoryAssetReference.STATUS_ASSIGNED
        asset.note = payload.validated_data.get("note", "")
        asset.save(update_fields=["assigned_to", "assigned_at", "status", "note", "updated_at"])
        return response.Response(self.get_serializer(asset).data)

    @decorators.action(detail=True, methods=["post"])
    @transaction.atomic
    def unassign(self, request, pk=None):
        asset = self.get_object()
        if asset.status == InventoryAssetReference.STATUS_OUT:
            raise ValidationError({"detail": "Reference deja sortie du stock."})
        asset.assigned_to = None
        asset.assigned_at = None
        asset.status = InventoryAssetReference.STATUS_IN_STOCK
        asset.save(update_fields=["assigned_to", "assigned_at", "status", "updated_at"])
        return response.Response(self.get_serializer(asset).data)
