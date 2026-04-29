from rest_framework import serializers

from .models import BillingModule, TenantSubscription


class BillingModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingModule
        fields = ("id", "code", "name", "description", "monthly_price_xof", "is_active")


class TenantSubscriptionSerializer(serializers.ModelSerializer):
    module = BillingModuleSerializer(read_only=True)

    class Meta:
        model = TenantSubscription
        fields = (
            "id",
            "module",
            "status",
            "started_at",
            "grace_until",
            "renewal_at",
            "auto_renew",
            "fedapay_transaction_id",
            "metadata",
            "created_at",
            "updated_at",
        )


class InitiateModulePaymentSerializer(serializers.Serializer):
    module_id = serializers.UUIDField(required=False)
    module_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
    )
    callback_url = serializers.URLField(required=False)
    module_months = serializers.DictField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        module_id = attrs.get("module_id")
        module_ids = attrs.get("module_ids") or []
        if not module_id and not module_ids:
            raise serializers.ValidationError("module_id ou module_ids est requis.")
        if module_id and module_ids:
            # On accepte les 2 formats mais on fusionne proprement.
            attrs["module_ids"] = list(dict.fromkeys([module_id, *module_ids]))
        elif module_id:
            attrs["module_ids"] = [module_id]
        else:
            attrs["module_ids"] = list(dict.fromkeys(module_ids))

        raw_module_months = attrs.get("module_months") or {}
        normalized_months = {}
        for key, value in raw_module_months.items():
            normalized_months[str(key)] = int(value)
        attrs["module_months"] = normalized_months
        return attrs


class SyncModulePaymentSerializer(serializers.Serializer):
    transaction_id = serializers.CharField()
