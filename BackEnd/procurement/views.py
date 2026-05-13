from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import (
    ProcurementPurchaseOrder,
    ProcurementPurchaseOrderLine,
    ProcurementPurchaseRequest,
    ProcurementPurchaseRequestLine,
    ProcurementSupplier,
)
from .serializers import (
    ProcurementPurchaseOrderLineSerializer,
    ProcurementPurchaseOrderSerializer,
    ProcurementPurchaseRequestLineSerializer,
    ProcurementPurchaseRequestSerializer,
    ProcurementSupplierSerializer,
)


class ProcurementSupplierViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementSupplierSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ProcurementSupplier.objects.all()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(company__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(city__icontains=search)
            )
        return queryset


class ProcurementPurchaseRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementPurchaseRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            ProcurementPurchaseRequest.objects.select_related("requested_by")
            .prefetch_related("lines", "generated_orders")
            .all()
        )
        status_value = (self.request.query_params.get("status") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(Q(reference__icontains=search) | Q(title__icontains=search))
        return queryset


class ProcurementPurchaseRequestLineViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementPurchaseRequestLineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ProcurementPurchaseRequestLine.objects.select_related("request").all()
        request_id = (self.request.query_params.get("request") or "").strip()
        if request_id:
            queryset = queryset.filter(request_id=request_id)
        return queryset


class ProcurementPurchaseOrderViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementPurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            ProcurementPurchaseOrder.objects.select_related("supplier", "source_request")
            .prefetch_related("lines")
            .all()
        )
        status_value = (self.request.query_params.get("status") or "").strip()
        supplier_id = (self.request.query_params.get("supplier") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        if search:
            queryset = queryset.filter(Q(reference__icontains=search) | Q(notes__icontains=search))
        return queryset


class ProcurementPurchaseOrderLineViewSet(viewsets.ModelViewSet):
    serializer_class = ProcurementPurchaseOrderLineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ProcurementPurchaseOrderLine.objects.select_related("order").all()
        order_id = (self.request.query_params.get("order") or "").strip()
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset
