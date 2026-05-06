from rest_framework import serializers

from .models import City, Country


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ("code", "iso3", "name", "continent", "capital", "currency_code", "phone_prefix")


class CitySerializer(serializers.ModelSerializer):
    country_code = serializers.CharField(source="country.code", read_only=True)

    class Meta:
        model = City
        fields = ("geoname_id", "name", "region", "country_code", "latitude", "longitude", "population")
