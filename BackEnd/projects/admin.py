from django.contrib import admin

from .models import InAppNotification, Milestone, Project, ProjectAttachment, Sprint, SubTask, Task, TaskAttachment, TaskComment, TaskDependency, Team, TimeEntry


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "owner", "work_team", "start_date", "end_date", "progress")
    list_filter = ("status",)
    search_fields = ("name", "description", "owner__username", "owner__email", "work_team__name")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "status", "priority", "assignee", "due_date")
    list_filter = ("status", "priority")
    search_fields = ("title", "description", "project__name")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "leader", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description", "leader__username", "leader__email")


@admin.register(InAppNotification)
class InAppNotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "recipient", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")
    search_fields = ("title", "message", "recipient__username", "recipient__email")


admin.site.register(Sprint)
admin.site.register(Milestone)
admin.site.register(SubTask)
admin.site.register(TaskDependency)
admin.site.register(TimeEntry)
admin.site.register(TaskComment)
admin.site.register(TaskAttachment)
admin.site.register(ProjectAttachment)
