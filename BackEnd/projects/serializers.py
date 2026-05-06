from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .date_bounds import (
    validate_against_project_window,
    validate_milestone_due_within_project,
    validate_sprint_dates_within_project,
)
from .notifications import (
    create_in_app_notification,
    notify_project_assignment,
    notify_project_membership_update,
    notify_task_assignment,
    notify_team_update,
)
from .models import (
    InAppNotification,
    Milestone,
    Project,
    Sprint,
    SubTask,
    Task,
    ProjectAttachment,
    TaskAttachment,
    TaskComment,
    TaskDependency,
    Team,
    TimeEntry,
)

User = get_user_model()


def _actor_name(request) -> str:
    if not request or not getattr(request, "user", None):
        return "Systeme"
    user = request.user
    return user.get_full_name() or user.username or user.email or "Systeme"


class TeamMemberSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")

    def get_role(self, obj):
        if obj.is_superuser:
            return "owner"
        if obj.is_staff:
            return "admin"
        return "member"


class TeamSerializer(serializers.ModelSerializer):
    leaderId = serializers.PrimaryKeyRelatedField(
        source="leader",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
    )
    leaderName = serializers.SerializerMethodField()
    memberIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
        source="member_ids",
    )
    members = TeamMemberSerializer(many=True, read_only=True)
    projectsCount = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = (
            "id",
            "name",
            "description",
            "is_active",
            "leaderId",
            "leaderName",
            "memberIds",
            "members",
            "projectsCount",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "leaderName", "members", "projectsCount")

    def get_leaderName(self, obj):
        if not obj.leader:
            return ""
        return obj.leader.get_full_name() or obj.leader.username

    def get_projectsCount(self, obj):
        return obj.projects.count()

    def _set_members(self, team, member_ids):
        if member_ids is not None:
            members = User.objects.filter(id__in=member_ids)
            team.members.set(members)
        if team.leader_id and not team.members.filter(id=team.leader_id).exists():
            team.members.add(team.leader)

    def validate(self, attrs):
        leader = attrs.get("leader", getattr(self.instance, "leader", None))
        member_ids = attrs.get("member_ids", None)
        if member_ids is not None and leader and leader.id not in member_ids:
            attrs["member_ids"] = [*member_ids, leader.id]
        return attrs

    def create(self, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        team = Team.objects.create(**validated_data)
        self._set_members(team, member_ids)
        request = self.context.get("request")
        recipients = list(team.members.all())
        if team.leader and team.leader not in recipients:
            recipients.append(team.leader)
        members_summary = ", ".join(
            team.members.order_by("first_name", "last_name", "username")
            .values_list("email", flat=True)
        )
        for user in recipients:
            if user.email:
                notify_team_update(
                    tenant=getattr(request, "tenant", None),
                    recipient_email=user.email,
                    team_name=team.name,
                    actor_name=_actor_name(request),
                    action_label="Equipe creee",
                    leader_name=self.get_leaderName(team),
                    members_summary=members_summary,
                )
            create_in_app_notification(
                recipient=user,
                title=f"Equipe creee: {team.name}",
                message="Vous avez ete ajoute a une nouvelle equipe de travail.",
                notification_type="success",
                link_url="/dashboard/teams",
                metadata={"team_id": str(team.id), "action": "team_created"},
            )
        return team

    def update(self, instance, validated_data):
        previous_leader_id = instance.leader_id
        previous_member_ids = set(instance.members.values_list("id", flat=True))
        member_ids = validated_data.pop("member_ids", None)
        team = super().update(instance, validated_data)
        self._set_members(team, member_ids)
        request = self.context.get("request")
        current_member_ids = set(team.members.values_list("id", flat=True))
        added = current_member_ids - previous_member_ids
        removed = previous_member_ids - current_member_ids
        leader_changed = previous_leader_id != team.leader_id
        if added or removed or leader_changed:
            details = []
            if added:
                details.append(f"{len(added)} membre(s) ajoute(s)")
            if removed:
                details.append(f"{len(removed)} membre(s) retire(s)")
            if leader_changed:
                details.append("responsable mis a jour")
            action_label = "Mise a jour equipe: " + ", ".join(details)
        else:
            action_label = "Equipe mise a jour"
        recipients = list(team.members.all())
        if team.leader and team.leader not in recipients:
            recipients.append(team.leader)
        members_summary = ", ".join(
            team.members.order_by("first_name", "last_name", "username")
            .values_list("email", flat=True)
        )
        for user in recipients:
            if user.email:
                notify_team_update(
                    tenant=getattr(request, "tenant", None),
                    recipient_email=user.email,
                    team_name=team.name,
                    actor_name=_actor_name(request),
                    action_label=action_label,
                    leader_name=self.get_leaderName(team),
                    members_summary=members_summary,
                )
            create_in_app_notification(
                recipient=user,
                title=f"Equipe mise a jour: {team.name}",
                message=action_label,
                notification_type="info",
                link_url="/dashboard/teams",
                metadata={"team_id": str(team.id), "action": "team_updated"},
            )
        return team


class ProjectSerializer(serializers.ModelSerializer):
    startDate = serializers.DateField(source="start_date", allow_null=True, required=False)
    endDate = serializers.DateField(source="end_date", allow_null=True, required=False)
    tenantId = serializers.SerializerMethodField()
    team = TeamMemberSerializer(source="members", many=True, read_only=True)
    memberIds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        allow_empty=True,
        source="member_ids",
    )
    workTeamId = serializers.PrimaryKeyRelatedField(
        source="work_team",
        queryset=Team.objects.all(),
        allow_null=True,
        required=False,
    )
    workTeamName = serializers.CharField(source="work_team.name", read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "status",
            "startDate",
            "endDate",
            "progress",
            "tenantId",
            "team",
            "memberIds",
            "workTeamId",
            "workTeamName",
            "color",
        )

    def get_progress(self, obj):
        """Pourcentage de tâches au statut « done » (0–100), basé sur les tâches du projet."""
        tasks = getattr(obj, "tasks", None)
        if tasks is None:
            return 0
        task_list = list(tasks.all())
        if not task_list:
            return 0
        done = sum(1 for t in task_list if t.status == Task.STATUS_DONE)
        return min(100, round((done / len(task_list)) * 100))

    def get_tenantId(self, obj):
        request = self.context.get("request")
        if request and getattr(request, "tenant", None):
            return str(request.tenant.pk)
        return None

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if self.instance:
            if start is None:
                start = self.instance.start_date
            if end is None:
                end = self.instance.end_date
        if start and end and start > end:
            raise serializers.ValidationError(
                {"endDate": "La date de fin doit etre posterieure ou egale au debut du projet."}
            )
        return attrs

    def _resolve_members(self, validated_data, project):
        member_ids = validated_data.get("member_ids")
        if member_ids is not None:
            members = User.objects.filter(id__in=member_ids)
            project.members.set(members)
            # Si le projet est rattache a une equipe de travail, tout membre ajoute
            # depuis le projet doit aussi rejoindre cette equipe.
            if project.work_team_id:
                project.work_team.members.add(*members)
            return
        if project.work_team_id:
            project.members.set(project.work_team.members.all())

    def create(self, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        project = Project.objects.create(**validated_data)
        if member_ids is not None:
            validated_data["member_ids"] = member_ids
        self._resolve_members(validated_data, project)
        request = self.context.get("request")
        if project.work_team_id:
            recipients = list(project.work_team.members.all())
            if project.work_team.leader and project.work_team.leader not in recipients:
                recipients.append(project.work_team.leader)
            for user in recipients:
                if user.email:
                    notify_project_assignment(
                        tenant=getattr(request, "tenant", None),
                        recipient_email=user.email,
                        project_name=project.name,
                        team_name=project.work_team.name,
                        actor_name=_actor_name(request),
                        project_id=str(project.id),
                    )
                create_in_app_notification(
                    recipient=user,
                    title=f"Projet assigne: {project.name}",
                    message=f"Le projet est desormais affecte a l'equipe {project.work_team.name}.",
                    notification_type="success",
                    link_url=f"/dashboard/projects/{project.id}",
                    metadata={"project_id": str(project.id), "action": "project_team_assigned"},
                )
        return project

    def update(self, instance, validated_data):
        previous_team_id = instance.work_team_id
        previous_member_ids = set(instance.members.values_list("id", flat=True))
        member_ids = validated_data.pop("member_ids", None)
        project = super().update(instance, validated_data)
        if member_ids is not None:
            validated_data["member_ids"] = member_ids
        self._resolve_members(validated_data, project)
        request = self.context.get("request")
        current_member_ids = set(project.members.values_list("id", flat=True))
        if member_ids is not None:
            added_ids = current_member_ids - previous_member_ids
            removed_ids = previous_member_ids - current_member_ids
            if added_ids:
                for user in User.objects.filter(id__in=added_ids):
                    if user.email:
                        notify_project_membership_update(
                            tenant=getattr(request, "tenant", None),
                            recipient_email=user.email,
                            project_name=project.name,
                            actor_name=_actor_name(request),
                            project_id=str(project.id),
                            action="added",
                        )
                    create_in_app_notification(
                        recipient=user,
                        title=f"Ajout au projet: {project.name}",
                        message=f"Vous avez ete ajoute au projet par {_actor_name(request)}.",
                        notification_type="success",
                        link_url=f"/dashboard/projects/{project.id}",
                        metadata={"project_id": str(project.id), "action": "project_member_added"},
                    )
            if removed_ids:
                for user in User.objects.filter(id__in=removed_ids):
                    if user.email:
                        notify_project_membership_update(
                            tenant=getattr(request, "tenant", None),
                            recipient_email=user.email,
                            project_name=project.name,
                            actor_name=_actor_name(request),
                            project_id=str(project.id),
                            action="removed",
                        )
                    create_in_app_notification(
                        recipient=user,
                        title=f"Retrait du projet: {project.name}",
                        message=f"Votre acces au projet a ete retire par {_actor_name(request)}.",
                        notification_type="warning",
                        link_url="/dashboard/projects",
                        metadata={"project_id": str(project.id), "action": "project_member_removed"},
                    )
        if project.work_team_id and previous_team_id != project.work_team_id:
            recipients = list(project.work_team.members.all())
            if project.work_team.leader and project.work_team.leader not in recipients:
                recipients.append(project.work_team.leader)
            for user in recipients:
                if user.email:
                    notify_project_assignment(
                        tenant=getattr(request, "tenant", None),
                        recipient_email=user.email,
                        project_name=project.name,
                        team_name=project.work_team.name,
                        actor_name=_actor_name(request),
                        project_id=str(project.id),
                    )
                create_in_app_notification(
                    recipient=user,
                    title=f"Affectation projet modifiee: {project.name}",
                    message=f"Le projet est maintenant affecte a l'equipe {project.work_team.name}.",
                    notification_type="info",
                    link_url=f"/dashboard/projects/{project.id}",
                    metadata={"project_id": str(project.id), "action": "project_team_reassigned"},
                )
        return project


class SubTaskSerializer(serializers.ModelSerializer):
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), write_only=True)
    taskId = serializers.UUIDField(source="task_id", read_only=True)

    class Meta:
        model = SubTask
        fields = ("id", "task", "taskId", "title", "completed")


class TaskCommentSerializer(serializers.ModelSerializer):
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), write_only=True)
    taskId = serializers.UUIDField(source="task_id", read_only=True)
    authorId = serializers.IntegerField(source="author_id", read_only=True)
    author = serializers.SerializerMethodField()
    authorAvatar = serializers.CharField(default="", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = TaskComment
        fields = ("id", "task", "taskId", "authorId", "author", "authorAvatar", "content", "createdAt")

    def get_author(self, obj):
        if obj.author.get_full_name():
            return obj.author.get_full_name()
        return obj.author.username

    def update(self, instance, validated_data):
        request = self.context.get("request")
        if request and instance.author_id != request.user.id:
            raise PermissionDenied("Seul l'auteur peut modifier ce commentaire.")
        return super().update(instance, validated_data)


class TaskAttachmentSerializer(serializers.ModelSerializer):
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), write_only=True)
    taskId = serializers.UUIDField(source="task_id", read_only=True)
    url = serializers.URLField(source="file_url")
    type = serializers.CharField(source="mime_type", required=False, allow_blank=True, default="")
    size = serializers.IntegerField(source="file_size", required=False, default=0)
    source = serializers.CharField(read_only=True)
    gedDocumentId = serializers.UUIDField(source="ged_document_id", read_only=True, allow_null=True)

    class Meta:
        model = TaskAttachment
        fields = ("id", "task", "taskId", "name", "url", "type", "size", "source", "gedDocumentId")


class ProjectAttachmentSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), write_only=True)
    projectId = serializers.UUIDField(source="project_id", read_only=True)
    url = serializers.URLField(source="file_url")
    type = serializers.CharField(source="mime_type", required=False, allow_blank=True, default="")
    size = serializers.IntegerField(source="file_size", required=False, default=0)
    source = serializers.CharField(read_only=True)
    gedDocumentId = serializers.UUIDField(source="ged_document_id", read_only=True, allow_null=True)

    class Meta:
        model = ProjectAttachment
        fields = ("id", "project", "projectId", "name", "url", "type", "size", "source", "gedDocumentId")


class TaskSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), write_only=True, required=False)
    projectId = serializers.UUIDField(source="project_id", read_only=True)
    startDate = serializers.DateField(source="start_date", allow_null=True, required=False)
    dueDate = serializers.DateField(source="due_date", allow_null=True, required=False)
    estimatedHours = serializers.DecimalField(source="estimated_hours", max_digits=7, decimal_places=2, allow_null=True, required=False)
    actualHours = serializers.DecimalField(source="actual_hours", max_digits=7, decimal_places=2, allow_null=True, required=False)
    assigneeId = serializers.PrimaryKeyRelatedField(
        source="assignee",
        queryset=User.objects.all(),
        allow_null=True,
        required=False,
    )
    assigneeAvatar = serializers.CharField(default="", read_only=True)
    assignee = serializers.SerializerMethodField()
    order = serializers.IntegerField(source="sort_order", required=False)
    subtasks = SubTaskSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "project",
            "projectId",
            "title",
            "description",
            "status",
            "priority",
            "assigneeId",
            "assignee",
            "assigneeAvatar",
            "dueDate",
            "startDate",
            "estimatedHours",
            "actualHours",
            "subtasks",
            "comments",
            "attachments",
            "order",
        )

    def get_assignee(self, obj):
        if not obj.assignee:
            return None
        return obj.assignee.get_full_name() or obj.assignee.username

    def validate(self, attrs):
        instance = self.instance
        project = attrs.get("project")
        if project is None:
            if instance is None:
                return attrs
            project = instance.project
        if project is None:
            return attrs

        if instance:
            start_date = attrs.get("start_date", instance.start_date)
            due_date = attrs.get("due_date", instance.due_date)
        else:
            start_date = attrs.get("start_date")
            due_date = attrs.get("due_date")

        validate_against_project_window(
            project_start=project.start_date,
            project_end=project.end_date,
            start_value=start_date,
            due_value=due_date,
        )
        assignee = attrs.get("assignee", getattr(instance, "assignee", None))
        if assignee and project.work_team_id and not project.work_team.members.filter(id=assignee.id).exists():
            raise serializers.ValidationError(
                {"assigneeId": "L'assigne doit appartenir a l'equipe assignee au projet."}
            )
        return attrs

    def create(self, validated_data):
        task = Task.objects.create(**validated_data)
        request = self.context.get("request")
        if task.assignee_id and task.assignee and task.assignee.email:
            notify_task_assignment(
                tenant=getattr(request, "tenant", None),
                recipient_email=task.assignee.email,
                project_name=task.project.name,
                task_title=task.title,
                actor_name=_actor_name(request),
                project_id=str(task.project_id),
            )
        if task.assignee_id and task.assignee:
            create_in_app_notification(
                recipient=task.assignee,
                title=f"Tache assignee: {task.title}",
                message=f"Vous etes assigne a une tache dans le projet {task.project.name}.",
                notification_type="info",
                link_url=f"/dashboard/projects/{task.project_id}",
                metadata={"task_id": str(task.id), "project_id": str(task.project_id), "action": "task_assigned"},
            )
        return task

    def update(self, instance, validated_data):
        previous_assignee_id = instance.assignee_id
        task = super().update(instance, validated_data)
        request = self.context.get("request")
        if task.assignee_id and task.assignee_id != previous_assignee_id and task.assignee and task.assignee.email:
            notify_task_assignment(
                tenant=getattr(request, "tenant", None),
                recipient_email=task.assignee.email,
                project_name=task.project.name,
                task_title=task.title,
                actor_name=_actor_name(request),
                project_id=str(task.project_id),
            )
        if task.assignee_id and task.assignee_id != previous_assignee_id and task.assignee:
            create_in_app_notification(
                recipient=task.assignee,
                title=f"Nouvelle affectation: {task.title}",
                message=f"La tache vous a ete affectee dans le projet {task.project.name}.",
                notification_type="info",
                link_url=f"/dashboard/projects/{task.project_id}",
                metadata={"task_id": str(task.id), "project_id": str(task.project_id), "action": "task_reassigned"},
            )
        return task


class SprintSerializer(serializers.ModelSerializer):
    startDate = serializers.DateField(source="start_date", allow_null=True, required=False)
    endDate = serializers.DateField(source="end_date", allow_null=True, required=False)

    class Meta:
        model = Sprint
        fields = ("id", "project", "name", "goal", "status", "startDate", "endDate")

    def validate(self, attrs):
        instance = self.instance
        project = attrs.get("project")
        if project is None and instance is not None:
            project = instance.project
        if project is None:
            return attrs

        if instance:
            start = attrs.get("start_date", instance.start_date)
            end = attrs.get("end_date", instance.end_date)
        else:
            start = attrs.get("start_date")
            end = attrs.get("end_date")

        validate_sprint_dates_within_project(project, start, end)
        return attrs


class MilestoneSerializer(serializers.ModelSerializer):
    dueDate = serializers.DateField(source="due_date", allow_null=True, required=False)

    class Meta:
        model = Milestone
        fields = ("id", "project", "title", "description", "dueDate", "completed")

    def validate(self, attrs):
        instance = self.instance
        project = attrs.get("project")
        if project is None and instance is not None:
            project = instance.project
        if project is None:
            return attrs

        if instance:
            due = attrs.get("due_date", instance.due_date)
        else:
            due = attrs.get("due_date")

        validate_milestone_due_within_project(project, due)
        return attrs


class TimeEntrySerializer(serializers.ModelSerializer):
    task = serializers.PrimaryKeyRelatedField(queryset=Task.objects.all(), write_only=True, required=False)
    taskId = serializers.UUIDField(source="task_id", read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    startedAt = serializers.DateTimeField(source="started_at")
    endedAt = serializers.DateTimeField(source="ended_at", allow_null=True, required=False)
    secondsSpent = serializers.IntegerField(source="seconds_spent")

    class Meta:
        model = TimeEntry
        fields = ("id", "task", "taskId", "user", "startedAt", "endedAt", "secondsSpent", "note")


class TaskDependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskDependency
        fields = ("id", "task", "depends_on")


class InAppNotificationSerializer(serializers.ModelSerializer):
    notificationType = serializers.CharField(source="notification_type", read_only=True)
    isRead = serializers.BooleanField(source="is_read", read_only=True)
    linkUrl = serializers.CharField(source="link_url", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = InAppNotification
        fields = (
            "id",
            "title",
            "message",
            "notificationType",
            "isRead",
            "linkUrl",
            "metadata",
            "createdAt",
        )
