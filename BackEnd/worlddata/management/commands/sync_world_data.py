from django.core.management.base import BaseCommand
from django.db import transaction
from geonamescache import GeonamesCache

from worlddata.models import City, Country


class Command(BaseCommand):
    help = "Synchronise les pays et villes du monde dans la base locale."

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-empty",
            action="store_true",
            help="Execute la synchronisation uniquement si les tables sont vides.",
        )

    @staticmethod
    def _to_float(value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _to_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get("if_empty") and Country.objects.exists() and City.objects.exists():
            self.stdout.write(self.style.SUCCESS("World data deja chargees, sync ignoree (--if-empty)."))
            return

        gc = GeonamesCache()
        country_data = gc.get_countries()
        city_data = gc.get_cities()

        self.stdout.write("Nettoyage des donnees monde...")
        City.objects.all().delete()
        Country.objects.all().delete()

        self.stdout.write("Import des pays...")
        countries_to_create = []
        seen_country_codes = set()
        for code, data in country_data.items():
            normalized_code = (code or "").upper().strip()[:2]
            if len(normalized_code) != 2:
                continue
            if normalized_code in seen_country_codes:
                continue
            seen_country_codes.add(normalized_code)

            countries_to_create.append(
                Country(
                    code=normalized_code,
                    iso3=(data.get("iso3") or "").upper()[:3],
                    name=(data.get("name") or "").strip()[:120],
                    continent=(data.get("continentcode") or "").strip()[:40],
                    capital=(data.get("capital") or "").strip()[:120],
                    currency_code=(data.get("currencycode") or "").strip()[:10],
                    phone_prefix=(data.get("phone") or "").strip()[:20],
                )
            )
        Country.objects.bulk_create(countries_to_create, batch_size=500, ignore_conflicts=True)
        countries_by_code = {country.code: country for country in Country.objects.all()}

        self.stdout.write("Import des villes...")
        cities_to_create = []
        seen_geoname_ids = set()
        for geoname_id_raw, data in city_data.items():
            country_code = (data.get("countrycode") or "").upper()[:2]
            country = countries_by_code.get(country_code)
            if not country:
                continue
            geoname_id = self._to_int(geoname_id_raw, default=0)
            if geoname_id <= 0:
                continue
            if geoname_id in seen_geoname_ids:
                continue
            seen_geoname_ids.add(geoname_id)
            cities_to_create.append(
                City(
                    geoname_id=geoname_id,
                    country=country,
                    name=(data.get("name") or "").strip()[:160],
                    region=(data.get("admin1code") or "").strip()[:160],
                    latitude=self._to_float(data.get("latitude"), default=0.0),
                    longitude=self._to_float(data.get("longitude"), default=0.0),
                    population=self._to_int(data.get("population"), default=0),
                )
            )

        City.objects.bulk_create(cities_to_create, batch_size=2000, ignore_conflicts=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"World data synchronisees: {Country.objects.count()} pays, {City.objects.count()} villes."
            )
        )
