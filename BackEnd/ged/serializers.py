from django.contrib.auth import get_user_model
from rest_framework import serializers

from .access import (
    can_edit_document,
    can_edit_folder,
    can_share_document,
    can_share_folder,
    can_view_document,
    can_view_folder,
    user_can_manage_ged_share,
)
from .models import Document, DocumentFolder, GedShare

User = get_user_model()


class DocumentFolderSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, allow_null=True)
    has_content = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    my_permission = serializers.SerializerMethodField()
    can_share = serializers.SerializerMethodField()

    class Meta:
        model = DocumentFolder
        fields = (
            "id",
            "name",
            "parent",
            "parent_name",
            "created_by",
            "created_by_name",
            "has_content",
            "my_permission",
            "can_share",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "parent_name",
            "has_content",
            "created_by",
            "created_by_name",
            "my_permission",
            "can_share",
        )

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return ""
        u = obj.created_by
        return u.get_full_name() or u.username or u.email or ""

    def get_has_content(self, obj):
        cc = getattr(obj, "_ged_child_count", None)
        dc = getattr(obj, "_ged_doc_count", None)
        if cc is not None and dc is not None:
            return (cc > 0) or (dc > 0)
        return obj.children.exists() or obj.documents.exists()

    def get_my_permission(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user = request.user
        if obj.created_by_id == user.id:
            return "owner"
        if can_edit_folder(user, obj):
            return "editor"
        if can_view_folder(user, obj):
            return "viewer"
        return None

    def get_can_share(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_share_folder(request.user, obj)

    def validate(self, attrs):
        parent = attrs.get("parent", getattr(self.instance, "parent", None) if self.instance else None)
        instance = self.instance
        if parent and instance and parent.pk == instance.pk:
            raise serializers.ValidationError({"parent": "Un dossier ne peut pas etre son propre parent."})
        if parent and instance:
            walk = parent
            while walk:
                if walk.pk == instance.pk:
                    raise serializers.ValidationError({"parent": "Parent invalide (cycle hierarchique)."})
                walk = walk.parent
        return attrs


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    folder_name = serializers.CharField(source="folder.name", read_only=True, allow_null=True)
    my_permission = serializers.SerializerMethodField()
    can_share = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields["file"].read_only = True

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "description",
            "folder",
            "folder_name",
            "file",
            "file_url",
            "original_filename",
            "mime_type",
            "file_size",
            "uploaded_by",
            "uploaded_by_name",
            "my_permission",
            "can_share",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "original_filename",
            "mime_type",
            "file_size",
            "uploaded_by",
            "uploaded_by_name",
            "file_url",
            "folder_name",
            "my_permission",
            "can_share",
            "created_at",
            "updated_at",
        )

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by_id:
            return ""
        u = obj.uploaded_by
        return u.get_full_name() or u.username or u.email or ""

    def get_file_url(self, obj):
        if not obj.file:
            return ""
        request = self.context.get("request")
        url = obj.file.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_my_permission(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user = request.user
        if obj.uploaded_by_id == user.id:
            return "owner"
        if can_edit_document(user, obj):
            return "editor"
        if can_view_document(user, obj):
            return "viewer"
        return None

    def get_can_share(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_share_document(request.user, obj)

    def create(self, validated_data):
        file = validated_data.get("file")
        if file:
            validated_data["original_filename"] = getattr(file, "name", "") or ""
            validated_data["mime_type"] = getattr(file, "content_type", "") or ""
            validated_data["file_size"] = getattr(file, "size", 0) or 0
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("file", None)
        return super().update(instance, validated_data)


class GedShareSerializer(serializers.ModelSerializer):
    shared_with_name = serializers.SerializerMethodField()
    shared_by_name = serializers.SerializerMethodField()
    inherited = serializers.SerializerMethodField()
    share_folder_name = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = GedShare
        fields = (
            "id",
            "folder",
            "document",
            "shared_with",
            "shared_with_name",
            "shared_by",
            "shared_by_name",
            "role",
            "inherited",
            "share_folder_name",
            "can_manage",
            "created_at",
        )
        read_only_fields = ("shared_by", "shared_by_name", "inherited", "share_folder_name", "can_manage", "created_at")

    def get_shared_with_name(self, obj):
        u = obj.shared_with
        return u.get_full_name() or u.username or u.email or ""

    def get_shared_by_name(self, obj):
        u = obj.shared_by
        return u.get_full_name() or u.username or u.email or ""

    def get_inherited(self, obj):
        fid = self.context.get("ged_share_list_folder_id")
        if fid and obj.folder_id and str(obj.folder_id) != str(fid):
            return True
        did = self.context.get("ged_share_list_document_id")
        doc_folder_id = self.context.get("ged_share_list_document_folder_id")
        if did and obj.folder_id and doc_folder_id:
            return str(obj.folder_id) != str(doc_folder_id)
        if did and obj.document_id and str(obj.document_id) != str(did):
            return True
        return False

    def get_share_folder_name(self, obj):
        if obj.folder_id and obj.folder:
            return obj.folder.name
        return ""

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return user_can_manage_ged_share(request.user, obj)

    def validate(self, attrs):
        if self.instance:
            return attrs
        f = attrs.get("folder")
        d = attrs.get("document")
        if bool(f) == bool(d):
            raise serializers.ValidationError("Indiquez exactement un dossier ou un document.")
        sw = attrs.get("shared_with")
        request = self.context.get("request")
        if request and sw and sw.pk == request.user.pk:
            raise serializers.ValidationError({"shared_with": "Vous ne pouvez pas partager avec vous-meme."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["shared_by"] = request.user
        return super().create(validated_data)
