from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Project, Task


class ProjectModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password="test-password",
        )

    def test_create_project_with_owner(self):
        project = Project.objects.create(name="CorpCore Test", owner=self.user)
        self.assertEqual(project.owner, self.user)
        self.assertEqual(project.status, Project.STATUS_PLANNING)

    def test_task_defaults(self):
        project = Project.objects.create(name="CorpCore Project", owner=self.user)
        task = Task.objects.create(project=project, title="Initial task")
        self.assertEqual(task.status, Task.STATUS_TODO)
        self.assertEqual(task.priority, Task.PRIORITY_MEDIUM)
