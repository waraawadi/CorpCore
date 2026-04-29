import uuid

from django.db import models


class Country(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=2, unique=True)
    iso3 = models.CharField(max_length=3, blank=True, default="")
    name = models.CharField(max_length=120)
    continent = models.CharField(max_length=40, blank=True, default="")
    capital = models.CharField(max_length=120, blank=True, default="")
    currency_code = models.CharField(max_length=10, blank=True, default="")
    phone_prefix = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class City(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    geoname_id = models.BigIntegerField(unique=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=160)
    region = models.CharField(max_length=160, blank=True, default="")
    latitude = models.FloatField(blank=True, null=True)
    longitude = models.FloatField(blank=True, null=True)
    population = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        indexes = [
            models.Index(fields=("country", "name")),
            models.Index(fields=("population",)),
        ]

    def __str__(self) -> str:
        return f"{self.name}, {self.country.code}"
