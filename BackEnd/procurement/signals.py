"""Signaux pour declencher les e-mails du module achats."""

from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import ProcurementPurchaseOrder, ProcurementPurchaseRequest
from .notifications import (
    notify_procurement_order_internal,
    notify_procurement_order_sent_to_supplier,
    notify_procurement_request_decision,
    notify_procurement_request_fulfilled,
    notify_procurement_request_submitted,
    _resolve_tenant,
)

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=ProcurementPurchaseRequest)
def procurement_request_store_old_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._procurement_old_status = None
        return
    try:
        prev = ProcurementPurchaseRequest.objects.get(pk=instance.pk)
        instance._procurement_old_status = prev.status
    except ProcurementPurchaseRequest.DoesNotExist:
        instance._procurement_old_status = None


@receiver(post_save, sender=ProcurementPurchaseRequest)
def procurement_request_notify(sender, instance, created, **kwargs):
    tenant = _resolve_tenant()
    if tenant is None:
        return
    actor = instance.requested_by
    try:
        if created:
            if instance.status == ProcurementPurchaseRequest.STATUS_SUBMITTED and actor:
                notify_procurement_request_submitted(tenant=tenant, request_obj=instance, actor=actor)
            if instance.status == ProcurementPurchaseRequest.STATUS_APPROVED and instance.requested_by:
                notify_procurement_request_decision(tenant=tenant, request_obj=instance, approved=True)
            if instance.status == ProcurementPurchaseRequest.STATUS_REJECTED and instance.requested_by:
                notify_procurement_request_decision(tenant=tenant, request_obj=instance, approved=False)
            return
        old = getattr(instance, "_procurement_old_status", None)
        if old == instance.status:
            return
        if instance.status == ProcurementPurchaseRequest.STATUS_SUBMITTED and old == ProcurementPurchaseRequest.STATUS_DRAFT:
            if actor:
                notify_procurement_request_submitted(tenant=tenant, request_obj=instance, actor=actor)
        elif instance.status == ProcurementPurchaseRequest.STATUS_APPROVED and old != ProcurementPurchaseRequest.STATUS_APPROVED:
            notify_procurement_request_decision(tenant=tenant, request_obj=instance, approved=True)
        elif instance.status == ProcurementPurchaseRequest.STATUS_REJECTED and old != ProcurementPurchaseRequest.STATUS_REJECTED:
            notify_procurement_request_decision(tenant=tenant, request_obj=instance, approved=False)
        elif instance.status == ProcurementPurchaseRequest.STATUS_FULFILLED and old != ProcurementPurchaseRequest.STATUS_FULFILLED:
            order = instance.generated_orders.order_by("-created_at").first()
            order_ref = order.reference if order else "—"
            notify_procurement_request_fulfilled(tenant=tenant, request_obj=instance, order_reference=order_ref)
    except Exception:
        logger.exception("Procurement: echec notifications demande %s", instance.pk)


@receiver(pre_save, sender=ProcurementPurchaseOrder)
def procurement_order_store_old_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._procurement_old_po_status = None
        return
    try:
        prev = ProcurementPurchaseOrder.objects.get(pk=instance.pk)
        instance._procurement_old_po_status = prev.status
    except ProcurementPurchaseOrder.DoesNotExist:
        instance._procurement_old_po_status = None


@receiver(post_save, sender=ProcurementPurchaseOrder)
def procurement_order_notify(sender, instance, created, **kwargs):
    tenant = _resolve_tenant()
    if tenant is None:
        return
    try:
        if created:
            notify_procurement_order_internal(tenant=tenant, order=instance, event="created")
            if instance.status == ProcurementPurchaseOrder.STATUS_SENT:
                notify_procurement_order_sent_to_supplier(tenant=tenant, order=instance)
            return
        old = getattr(instance, "_procurement_old_po_status", None)
        if old == instance.status:
            return
        if instance.status == ProcurementPurchaseOrder.STATUS_SENT and old != ProcurementPurchaseOrder.STATUS_SENT:
            notify_procurement_order_sent_to_supplier(tenant=tenant, order=instance)
        if instance.status == ProcurementPurchaseOrder.STATUS_RECEIVED and old != ProcurementPurchaseOrder.STATUS_RECEIVED:
            notify_procurement_order_internal(tenant=tenant, order=instance, event="received")
    except Exception:
        logger.exception("Procurement: echec notifications bon %s", instance.pk)
