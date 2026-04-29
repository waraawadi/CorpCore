from django.test import TestCase

from .models import Client


class TenantModelTests(TestCase):
    def test_create_tenant(self):
        tenant = Client.objects.create(schema_name="acme", slug="acme", name="Acme")
        self.assertEqual(tenant.slug, "acme")
        self.assertEqual(tenant.schema_name, "acme")
