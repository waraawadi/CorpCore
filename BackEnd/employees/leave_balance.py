"""Calcul des soldes de conges payes (jours calendaires par annee civile)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from .models import EmployeeProfile, LeaveRequest


def overlap_days_in_year(start: date, end: date, year: int) -> Decimal:
    """Nombre de jours du segment [start, end] qui tombent dans l'annee `year`."""
    y0 = date(year, 1, 1)
    y1 = date(year, 12, 31)
    s = max(start, y0)
    e = min(end, y1)
    if e < s:
        return Decimal("0")
    return Decimal(str((e - s).days + 1))


def annual_days_used_in_year(*, employee_id, year: int) -> Decimal:
    """Conges payes approuves chevauchant l'annee (somme des jours dans l'annee)."""
    start_year = date(year, 1, 1)
    end_year = date(year, 12, 31)
    qs = LeaveRequest.objects.filter(
        employee_id=employee_id,
        leave_type=LeaveRequest.TYPE_ANNUAL,
        status=LeaveRequest.STATUS_APPROVED,
    ).filter(start_date__lte=end_year, end_date__gte=start_year)
    total = Decimal("0")
    for lr in qs:
        total += overlap_days_in_year(lr.start_date, lr.end_date, year)
    return total


def annual_days_pending_in_year(
    *, employee_id, year: int, exclude_leave_id=None
) -> Decimal:
    """Conges payes en attente (hors demande exclue pour edition)."""
    start_year = date(year, 1, 1)
    end_year = date(year, 12, 31)
    qs = LeaveRequest.objects.filter(
        employee_id=employee_id,
        leave_type=LeaveRequest.TYPE_ANNUAL,
        status=LeaveRequest.STATUS_PENDING,
    ).filter(start_date__lte=end_year, end_date__gte=start_year)
    if exclude_leave_id:
        qs = qs.exclude(pk=exclude_leave_id)
    total = Decimal("0")
    for lr in qs:
        total += overlap_days_in_year(lr.start_date, lr.end_date, year)
    return total


def annual_entitlement_for_employee(employee: EmployeeProfile) -> Decimal:
    return employee.annual_leave_entitlement_days or Decimal("0")


def annual_remaining_by_year(
    *,
    employee: EmployeeProfile,
    year: int,
    exclude_leave_id=None,
) -> Decimal:
    """Solde restant = droit - utilises approuves - en attente."""
    ent = annual_entitlement_for_employee(employee)
    used = annual_days_used_in_year(employee_id=employee.id, year=year)
    pending = annual_days_pending_in_year(
        employee_id=employee.id, year=year, exclude_leave_id=exclude_leave_id
    )
    return ent - used - pending


def annual_needed_by_year(start: date, end: date) -> dict[int, Decimal]:
    """Decoupe une demande en jours par annee civile."""
    out: dict[int, Decimal] = {}
    for y in range(start.year, end.year + 1):
        d = overlap_days_in_year(start, end, y)
        if d > 0:
            out[y] = d
    return out


def validate_annual_leave_balance(
    *,
    employee: EmployeeProfile,
    start_date: date,
    end_date: date,
    exclude_leave_id=None,
) -> None:
    """Leve ValidationError si le solde annuel est insuffisant sur une annee touchee."""
    from rest_framework import serializers

    needed = annual_needed_by_year(start_date, end_date)
    for year, days_needed in needed.items():
        remaining = annual_remaining_by_year(
            employee=employee,
            year=year,
            exclude_leave_id=exclude_leave_id,
        )
        if days_needed > remaining:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        f"Solde conges payes insuffisant pour {year}: "
                        f"{days_needed} j. demandes, {remaining} j. disponibles (apres prise en compte des demandes en attente)."
                    ]
                }
            )
