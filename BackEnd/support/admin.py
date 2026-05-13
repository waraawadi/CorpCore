from django.contrib import admin

from .models import SupportTicket, SupportTicketComment


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("reference", "title", "status", "priority", "category", "requester", "assignee", "created_at")
    list_filter = ("status", "priority", "category")
    search_fields = ("reference", "title", "description")


@admin.register(SupportTicketComment)
class SupportTicketCommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "created_at")
    search_fields = ("body",)
