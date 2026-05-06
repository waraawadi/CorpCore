from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BillingModuleViewSet,
    FedaPaySubscriptionWebhookView,
    InitiateModulePaymentView,
    SyncModulePaymentView,
    TenantSubscriptionViewSet,
)

router = DefaultRouter()
router.register("modules", BillingModuleViewSet, basename="billing-modules")
router.register("subscriptions", TenantSubscriptionViewSet, basename="tenant-subscriptions")

urlpatterns = [
    path("", include(router.urls)),
    path("payments/initiate/", InitiateModulePaymentView.as_view(), name="billing-payment-initiate"),
    path("payments/sync/", SyncModulePaymentView.as_view(), name="billing-payment-sync"),
    path("payments/webhook/", FedaPaySubscriptionWebhookView.as_view(), name="billing-payment-webhook"),
]
