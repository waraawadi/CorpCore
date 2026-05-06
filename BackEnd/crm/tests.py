from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import CrmContact, CrmLead

User = get_user_model()


class CrmModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1@example.com", email="u1@example.com", password="x")

    def test_create_contact_and_lead(self):
        c = CrmContact.objects.create(first_name="Ada", last_name="Lovelace", owner=self.user)
        lead = CrmLead.objects.create(title="Intégration API", owner=self.user, contact=c)
        self.assertEqual(lead.contact, c)
        self.assertEqual(lead.status, CrmLead.STATUS_NEW)
