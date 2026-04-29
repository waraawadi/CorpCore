from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import City, Country
from .serializers import CitySerializer, CountrySerializer


class PublicCountryListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        limit = min(max(int(request.query_params.get("limit", 100)), 1), 300)
        countries = Country.objects.all()
        if query:
            countries = countries.filter(name__icontains=query)
        countries = countries.order_by("name")[:limit]
        return Response(CountrySerializer(countries, many=True).data)


class PublicCityListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        country_code = (request.query_params.get("country") or "").strip().upper()
        query = (request.query_params.get("q") or "").strip()
        limit = min(max(int(request.query_params.get("limit", 100)), 1), 300)

        if not country_code:
            return Response([])

        cities = City.objects.filter(country__code=country_code)
        if query:
            cities = cities.filter(name__icontains=query)
        cities = cities.order_by("-population", "name")[:limit]
        return Response(CitySerializer(cities, many=True).data)
