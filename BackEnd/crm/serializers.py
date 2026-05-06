from decimal import Decimal

from rest_framework import serializers

from .models import CrmActivity, CrmContact, CrmLead, CrmOpportunity


class CrmContactSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = CrmContact
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "company_name",
            "notes",
            "owner",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")


class CrmLeadSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    contact = serializers.PrimaryKeyRelatedField(queryset=CrmContact.objects.all(), allow_null=True, required=False)

    class Meta:
        model = CrmLead
        fields = (
            "id",
            "title",
            "status",
            "source",
            "contact",
            "owner",
            "estimated_value",
            "next_follow_up_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")


class CrmOpportunitySerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    lead = serializers.PrimaryKeyRelatedField(queryset=CrmLead.objects.all(), allow_null=True, required=False)
    contact = serializers.PrimaryKeyRelatedField(queryset=CrmContact.objects.all(), allow_null=True, required=False)

    class Meta:
        model = CrmOpportunity
        fields = (
            "id",
            "name",
            "stage",
            "amount",
            "probability",
            "lead",
            "contact",
            "owner",
            "expected_close_date",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")


class CrmActivitySerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    contact = serializers.PrimaryKeyRelatedField(queryset=CrmContact.objects.all(), allow_null=True, required=False)
    lead = serializers.PrimaryKeyRelatedField(queryset=CrmLead.objects.all(), allow_null=True, required=False)
    opportunity = serializers.PrimaryKeyRelatedField(
        queryset=CrmOpportunity.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = CrmActivity
        fields = (
            "id",
            "activity_type",
            "subject",
            "body",
            "contact",
            "lead",
            "opportunity",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        contact = attrs.get("contact")
        lead = attrs.get("lead")
        opportunity = attrs.get("opportunity")
        if self.instance:
            contact = contact if "contact" in attrs else self.instance.contact
            lead = lead if "lead" in attrs else self.instance.lead
            opportunity = opportunity if "opportunity" in attrs else self.instance.opportunity
        if not any([contact, lead, opportunity]):
            raise serializers.ValidationError(
                {"non_field_errors": ["Precisez au moins un lien: contact, piste ou opportunite."]}
            )
        return attrs


class ConvertLeadSerializer(serializers.Serializer):
    opportunity_name = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    stage = serializers.ChoiceField(choices=CrmOpportunity.STAGE_CHOICES, default=CrmOpportunity.STAGE_DISCOVERY)
    expected_close_date = serializers.DateField(required=False, allow_null=True)
