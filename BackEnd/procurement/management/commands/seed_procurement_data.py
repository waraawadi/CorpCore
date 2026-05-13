import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from procurement.models import (
    ProcurementPurchaseOrder,
    ProcurementPurchaseOrderLine,
    ProcurementPurchaseRequest,
    ProcurementPurchaseRequestLine,
    ProcurementSupplier,
)
from tenants.models import Client

User = get_user_model()


class Command(BaseCommand):
    help = "Genere des donnees factices pour le module achats (procurement) sur un tenant."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="Schema du tenant (ex: mgs)")
        parser.add_argument(
            "--count",
            type=int,
            default=40,
            help="Nombre total d'enregistrements a creer (reparti sur 5 familles: fournisseurs, demandes, lignes demande, BC, lignes BC). Defaut: 40.",
        )
        parser.add_argument("--seed", type=int, default=42, help="Graine pseudo-aleatoire")

    def handle(self, *args, **options):
        tenant_schema = options["tenant"].strip()
        total = options["count"]
        seed = options["seed"]

        if total < 5:
            raise CommandError("--count doit etre au moins 5 pour repartir sur les 5 types.")

        tenant = Client.objects.filter(schema_name=tenant_schema).first()
        if not tenant:
            raise CommandError(f"Tenant introuvable: {tenant_schema}")

        random.seed(seed)

        # Repartition en 5 parts egales (comme demande: ~40 lignes au total pour count=40).
        base = total // 5
        remainder = total % 5
        parts = [base + (1 if i < remainder else 0) for i in range(5)]
        n_suppliers, n_requests, n_req_lines, n_orders, n_ord_lines = parts

        with schema_context(tenant_schema):
            with transaction.atomic():
                user = User.objects.order_by("id").first()
                suppliers = self._create_suppliers(n_suppliers)
                requests_list = self._create_requests(n_requests, user)
                self._create_request_lines(n_req_lines, requests_list)
                orders_list = self._create_orders(n_orders, suppliers, requests_list)
                self._create_order_lines(n_ord_lines, orders_list)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed procurement termine pour '{tenant_schema}': "
                f"{n_suppliers} fournisseurs, {n_requests} demandes (+lignes), "
                f"{n_orders} bons (+lignes), total cible {total} enregistrements."
            )
        )

    def _create_suppliers(self, n: int):
        cities = ["Cotonou", "Porto-Novo", "Parakou", "Abomey-Calavi", "Lokossa", "Ouidah", "Bohicon", "Natitingou"]
        labels = [
            "Afrique Papeterie",
            "Benin IT Supply",
            "Sahel Equipements",
            "Atlantique Logistique",
            "Delta Fournitures",
            "Nova Industrie",
            "Eco Materiel Pro",
            "Sud Bureautique",
            "Zenith Import",
            "Orizon Textiles",
            "Kora Packaging",
            "Mawu Services",
            "Ganvie Distribution",
            "Tata Somba Trade",
            "Adjara Supply",
        ]
        suppliers = []
        for i in range(n):
            suffix = uuid.uuid4().hex[:6].upper()
            name = f"{random.choice(labels)} {suffix}"
            suppliers.append(
                ProcurementSupplier.objects.create(
                    name=name,
                    company=f"{name} SARL",
                    email=f"contact.{suffix.lower()}@demo-procurement.local",
                    phone=f"22997{random.randint(1000000, 9999999)}",
                    city=random.choice(cities),
                    country="Benin",
                    address=f"{random.randint(1, 200)} Avenue de la Republique",
                    tax_id=f"IFU-DEMO-{suffix}",
                    notes="Fournisseur genere par seed_procurement_data",
                    is_active=random.random() > 0.08,
                )
            )
        return suppliers

    def _create_requests(self, n: int, user):
        statuses = [
            ProcurementPurchaseRequest.STATUS_DRAFT,
            ProcurementPurchaseRequest.STATUS_SUBMITTED,
            ProcurementPurchaseRequest.STATUS_APPROVED,
            ProcurementPurchaseRequest.STATUS_REJECTED,
            ProcurementPurchaseRequest.STATUS_FULFILLED,
        ]
        titles = [
            "Achat consommables bureau",
            "Renouvellement materiel informatique",
            "Fournitures atelier",
            "Equipements securite",
            "Mobilier open-space",
            "Pieces de rechange vehicules",
            "Marketing print",
            "Cantine entreprise",
        ]
        requests_list = []
        for _ in range(n):
            requests_list.append(
                ProcurementPurchaseRequest.objects.create(
                    title=random.choice(titles),
                    status=random.choice(statuses),
                    notes=f"Demande factice generee le {timezone.now().isoformat()}",
                    requested_by=user,
                )
            )
        return requests_list

    def _create_request_lines(self, n: int, requests_list):
        if not requests_list or n <= 0:
            return
        items = [
            ("Ramettes papier A4", Decimal("4500")),
            ("Cartouches encre", Decimal("12000")),
            ("Chaises ergonomiques", Decimal("85000")),
            ("Switch reseau 24p", Decimal("180000")),
            ("Gants nitrile (carton)", Decimal("22000")),
            ("Cable RJ45 (rouleau)", Decimal("35000")),
            ("Tableau blanc magnetique", Decimal("25000")),
            ("Projecteur salle reunion", Decimal("320000")),
        ]
        for _ in range(n):
            req = random.choice(requests_list)
            desc, price = random.choice(items)
            ProcurementPurchaseRequestLine.objects.create(
                request=req,
                description=f"{desc} (lot demo)",
                quantity=Decimal(str(random.randint(1, 20))),
                unit_price=price + Decimal(str(random.randint(0, 5000))),
            )

    def _create_orders(self, n: int, suppliers, requests_list):
        if not suppliers or n <= 0:
            return []
        statuses = [
            ProcurementPurchaseOrder.STATUS_DRAFT,
            ProcurementPurchaseOrder.STATUS_SENT,
            ProcurementPurchaseOrder.STATUS_PARTIALLY_RECEIVED,
            ProcurementPurchaseOrder.STATUS_RECEIVED,
            ProcurementPurchaseOrder.STATUS_CANCELLED,
        ]
        orders_list = []
        for i in range(n):
            supplier = random.choice(suppliers)
            src = random.choice(requests_list) if requests_list and random.random() > 0.35 else None
            orders_list.append(
                ProcurementPurchaseOrder.objects.create(
                    supplier=supplier,
                    status=random.choice(statuses),
                    notes=f"Bon factice #{i + 1}",
                    expected_delivery=(timezone.now().date() + timedelta(days=random.randint(5, 60)))
                    if random.random() > 0.2
                    else None,
                    source_request=src,
                )
            )
        return orders_list

    def _create_order_lines(self, n: int, orders_list):
        if not orders_list or n <= 0:
            return
        items = [
            ("Prestation maintenance", Decimal("150000")),
            ("Licence logiciel annuelle", Decimal("450000")),
            ("Transport express", Decimal("75000")),
            ("Formation utilisateurs", Decimal("200000")),
            ("Kit demarrage", Decimal("95000")),
        ]
        for _ in range(n):
            order = random.choice(orders_list)
            desc, price = random.choice(items)
            ProcurementPurchaseOrderLine.objects.create(
                order=order,
                description=f"{desc} — ref demo",
                quantity=Decimal(str(random.randint(1, 5))),
                unit_price=price + Decimal(str(random.randint(0, 25000))),
            )
