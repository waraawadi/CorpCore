from django.contrib import admin

from .models import City, Country


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "iso3", "continent", "capital", "currency_code", "phone_prefix")
    search_fields = ("name", "code", "iso3", "capital")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "region", "population")
    search_fields = ("name", "country__name", "country__code", "region")
    list_filter = ("country__code",)
