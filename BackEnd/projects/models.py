import uuid

from django.conf import settings
from django.db import models


def project_attachment_upload_to(instance, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if len(ext) > 12:
        ext = "bin"
    return f"projects/{uuid.uuid4()}.{ext}"


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Team(TimeStampedModel):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="led_teams",
    )
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="work_teams", blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(fields=("name",), name="uniq_team_name"),
        ]

    def __str__(self) -> str:
        return self.name


class Project(TimeStampedModel):
    STATUS_PLANNING = "planning"
    STATUS_ACTIVE = "active"
    STATUS_ON_HOLD = "on_hold"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = (
        (STATUS_PLANNING, "Planning"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_ON_HOLD, "On hold"),
        (STATUS_COMPLETED, "Completed"),
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PLANNING)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    progress = models.PositiveSmallIntegerField(default=0)
    color = models.CharField(max_length=20, blank=True, default="")
    work_team = models.ForeignKey(
        Team,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="projects",
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_projects")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="projects", blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.name


class Sprint(TimeStampedModel):
    STATUS_PLANNED = "planned"
    STATUS_ACTIVE = "active"
    STATUS_CLOSED = "closed"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sprints")
    name = models.CharField(max_length=200)
    goal = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=((STATUS_PLANNED, "Planned"), (STATUS_ACTIVE, "Active"), (STATUS_CLOSED, "Closed")),
        default=STATUS_PLANNED,
    )
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.project.name} - {self.name}"


class Milestone(TimeStampedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(blank=True, null=True)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ("due_date", "created_at")

    def __str__(self) -> str:
        return self.title


class Task(TimeStampedModel):
    STATUS_BACKLOG = "backlog"
    STATUS_TODO = "todo"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_REVIEW = "review"
    STATUS_DONE = "done"

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    sprint = models.ForeignKey(Sprint, on_delete=models.SET_NULL, blank=True, null=True, related_name="tasks")
    milestone = models.ForeignKey(Milestone, on_delete=models.SET_NULL, blank=True, null=True, related_name="tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=30,
        choices=(
            (STATUS_BACKLOG, "Backlog"),
            (STATUS_TODO, "To do"),
            (STATUS_IN_PROGRESS, "In progress"),
            (STATUS_REVIEW, "Review"),
            (STATUS_DONE, "Done"),
        ),
        default=STATUS_TODO,
    )
    priority = models.CharField(
        max_length=20,
        choices=(
            (PRIORITY_LOW, "Low"),
            (PRIORITY_MEDIUM, "Medium"),
            (PRIORITY_HIGH, "High"),
            (PRIORITY_URGENT, "Urgent"),
        ),
        default=PRIORITY_MEDIUM,
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="assigned_tasks",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="reported_tasks",
    )
    start_date = models.DateField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    actual_hours = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("status", "sort_order", "-created_at")

    def __str__(self) -> str:
        return self.title


class SubTask(TimeStampedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField(max_length=255)
    completed = models.BooleanField(default=False)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return self.title


class TaskDependency(TimeStampedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="dependencies")
    depends_on = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="dependents")

    class Meta:
        unique_together = ("task", "depends_on")


class TimeEntry(TimeStampedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="time_entries")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_entries")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(blank=True, null=True)
    seconds_spent = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("-started_at",)


class TaskComment(TimeStampedModel):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_comments")
    content = models.TextField()

    class Meta:
        ordering = ("created_at",)


class TaskAttachment(TimeStampedModel):
    SOURCE_UPLOAD = "upload"
    SOURCE_GED = "ged"
    SOURCE_LINK = "link"
    SOURCE_CHOICES = (
        (SOURCE_UPLOAD, "Upload"),
        (SOURCE_GED, "GED"),
        (SOURCE_LINK, "Link"),
    )

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=1024)
    mime_type = models.CharField(max_length=120, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_LINK)
    file = models.FileField(upload_to=project_attachment_upload_to, blank=True, null=True)
    ged_document = models.ForeignKey(
        "ged.Document",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="task_attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="task_attachments",
    )

    class Meta:
        ordering = ("-created_at",)


class ProjectAttachment(TimeStampedModel):
    SOURCE_UPLOAD = "upload"
    SOURCE_GED = "ged"
    SOURCE_LINK = "link"
    SOURCE_CHOICES = (
        (SOURCE_UPLOAD, "Upload"),
        (SOURCE_GED, "GED"),
        (SOURCE_LINK, "Link"),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="attachments")
    name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=1024)
    mime_type = models.CharField(max_length=120, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    source = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_LINK)
    file = models.FileField(upload_to=project_attachment_upload_to, blank=True, null=True)
    ged_document = models.ForeignKey(
        "ged.Document",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="project_attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="project_attachments",
    )

    class Meta:
        ordering = ("-created_at",)


class InAppNotification(TimeStampedModel):
    TYPE_INFO = "info"
    TYPE_SUCCESS = "success"
    TYPE_WARNING = "warning"
    TYPE_ERROR = "error"

    TYPE_CHOICES = (
        (TYPE_INFO, "Info"),
        (TYPE_SUCCESS, "Success"),
        (TYPE_WARNING, "Warning"),
        (TYPE_ERROR, "Error"),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="in_app_notifications",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INFO)
    is_read = models.BooleanField(default=False)
    link_url = models.CharField(max_length=500, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.recipient_id} - {self.title}"
