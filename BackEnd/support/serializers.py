from rest_framework import serializers

from django.contrib.auth import get_user_model

from .models import SupportTicket, SupportTicketComment

User = get_user_model()


def _user_label(user) -> str:
    if not user:
        return ""
    name = (user.get_full_name() or "").strip()
    if name and user.email:
        return f"{name} ({user.email})"
    return name or (user.email or user.username or str(user.pk))


class SupportTicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketComment
        fields = ("id", "ticket", "author", "author_name", "body", "created_at", "updated_at")
        read_only_fields = ("author", "author_name", "created_at", "updated_at")

    def get_author_name(self, obj):
        return _user_label(obj.author)


class SupportTicketListSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    comments_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "reference",
            "title",
            "description",
            "category",
            "priority",
            "status",
            "requester",
            "requester_name",
            "assignee",
            "assignee_name",
            "resolved_at",
            "comments_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("reference", "requester", "requester_name", "assignee_name", "resolved_at", "created_at", "updated_at")

    def get_requester_name(self, obj):
        return _user_label(obj.requester)

    def get_assignee_name(self, obj):
        return _user_label(obj.assignee) if obj.assignee_id else ""


class SupportTicketDetailSerializer(SupportTicketListSerializer):
    comments = SupportTicketCommentSerializer(many=True, read_only=True)

    class Meta(SupportTicketListSerializer.Meta):
        fields = tuple(SupportTicketListSerializer.Meta.fields) + ("comments",)


class SupportTicketWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = (
            "title",
            "description",
            "category",
            "priority",
            "status",
            "assignee",
        )

    def validate_title(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("Le titre est obligatoire.")
        return value.strip()


class SupportTicketCommentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicketComment
        fields = ("ticket", "body")

    def validate_body(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("Le message est obligatoire.")
        return value.strip()
