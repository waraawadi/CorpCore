import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from sales.models import SalesCustomer, SalesOrder, SalesOrderLine, SalesProduct, SalesStockMovement
from tenants.models import Client


class Command(BaseCommand):
    help = "Genere des donnees factices pour le module ventes sur un tenant."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="Schema du tenant (ex: mgs)")
        parser.add_argument("--count", type=int, default=30, help="Nombre de commandes a creer")
        parser.add_argument("--seed", type=int, default=42, help="Graine pseudo-aleatoire")

    def handle(self, *args, **options):
        tenant_schema = options["tenant"].strip()
        count = options["count"]
        seed = options["seed"]

        if count <= 0:
            raise CommandError("--count doit etre strictement positif.")

        tenant = Client.objects.filter(schema_name=tenant_schema).first()
        if not tenant:
            raise CommandError(f"Tenant introuvable: {tenant_schema}")

        random.seed(seed)

        with schema_context(tenant_schema):
            with transaction.atomic():
                customers = self._create_customers()
                products = self._create_products()
                self._create_orders(customers, products, count)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed termine pour tenant '{tenant_schema}' avec {count} commandes factices."
            )
        )

    def _create_customers(self):
        base_customers = [
            ("MGS Distribution", "contact@mgs-distribution.com", "22990000001", "Cotonou"),
            ("Beni Global Trade", "sales@beniglobal.com", "22990000002", "Porto-Novo"),
            ("Sahel Retail", "orders@sahelretail.com", "22990000003", "Parakou"),
            ("Atlantique Services", "hello@atlantique-services.com", "22990000004", "Abomey-Calavi"),
            ("Delta Commerce", "contact@delta-commerce.com", "22990000005", "Bohicon"),
            ("Nova Market", "achats@novamarket.com", "22990000006", "Cotonou"),
            ("Eco Plus", "admin@ecoplus.com", "22990000007", "Ouidah"),
            ("Sud Supply", "service@sudsupply.com", "22990000008", "Lokossa"),
            ("Zenith Store", "info@zenithstore.com", "22990000009", "Cotonou"),
            ("Orizon Group", "support@orizongroup.com", "22990000010", "Parakou"),
        ]
        customers = []
        for idx, (name, email, phone, city) in enumerate(base_customers, start=1):
            customer, _ = SalesCustomer.objects.get_or_create(
                name=name,
                defaults={
                    "company": name,
                    "email": email,
                    "phone": phone,
                    "city": city,
                    "country": "Benin",
                    "tax_id": f"TAX-MGS-{idx:03d}",
                    "address": f"{idx} Rue du Commerce",
                    "notes": "Client genere automatiquement",
                    "is_active": True,
                },
            )
            customers.append(customer)
        return customers

    def _create_products(self):
        base_products = [
            ("Papier A4 80g", "PAP-A4-80", Decimal("3500.00")),
            ("Stylo Bleu", "STY-BLEU", Decimal("250.00")),
            ("Classeurs A4", "CLA-A4", Decimal("1200.00")),
            ("Enveloppes C5", "ENV-C5", Decimal("1800.00")),
            ("Cartouche Encre Noire", "ENC-NOIR", Decimal("9500.00")),
            ("Toner Laser", "TON-LAS", Decimal("28000.00")),
            ("Agrafeuse Metal", "AGR-MET", Decimal("3200.00")),
            ("Bloc Notes", "BLO-NOT", Decimal("700.00")),
        ]
        products = []
        for idx, (name, sku, price) in enumerate(base_products, start=1):
            product, created = SalesProduct.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "description": f"{name} - produit fictif",
                    "unit_price": price,
                    "stock_quantity": Decimal("1000.00"),
                    "reorder_level": Decimal("100.00"),
                    "is_active": True,
                },
            )
            if created:
                SalesStockMovement.objects.create(
                    product=product,
                    movement_type=SalesStockMovement.TYPE_IN,
                    quantity=Decimal("1000.00"),
                    note="Stock initial seed",
                )
            products.append(product)
        return products

    def _create_orders(self, customers, products, count):
        status_choices = [
            SalesOrder.STATUS_DRAFT,
            SalesOrder.STATUS_CONFIRMED,
            SalesOrder.STATUS_CONFIRMED,
            SalesOrder.STATUS_CANCELLED,
        ]
        now = timezone.now()

        for i in range(count):
            customer = random.choice(customers)
            order = SalesOrder.objects.create(
                customer=customer,
                status=random.choice(status_choices),
                ordered_at=now - timedelta(days=random.randint(0, 90)),
                notes=f"Commande factice #{i + 1}",
            )

            lines_count = random.randint(1, 4)
            sampled_products = random.sample(products, k=min(lines_count, len(products)))
            for product in sampled_products:
                quantity = Decimal(str(random.randint(1, 10)))
                SalesOrderLine.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=product.unit_price,
                )
