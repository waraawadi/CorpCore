from django.urls import path

from .views import PublicCityListView, PublicCountryListView

urlpatterns = [
    path("countries/", PublicCountryListView.as_view(), name="public-world-countries"),
    path("cities/", PublicCityListView.as_view(), name="public-world-cities"),
]
