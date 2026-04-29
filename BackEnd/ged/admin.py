from django.contrib import admin

from .models import Document, DocumentFolder, GedShare


@admin.register(DocumentFolder)
class DocumentFolderAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "created_by", "created_at")
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "folder", "uploaded_by", "file_size", "created_at")
    search_fields = ("title", "original_filename")
    readonly_fields = ("original_filename", "mime_type", "file_size", "created_at", "updated_at")


@admin.register(GedShare)
class GedShareAdmin(admin.ModelAdmin):
    list_display = ("folder", "document", "shared_with", "role", "shared_by", "created_at")
    search_fields = ("folder__name", "document__title")
