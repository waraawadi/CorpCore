"""Validation des dates par rapport à la période du projet (start_date / end_date)."""

from __future__ import annotations

from datetime import date
from typing import Optional

from rest_framework import serializers


def _bounds_error(field: str, message: str) -> serializers.ValidationError:
    return serializers.ValidationError({field: message})


def validate_against_project_window(
    *,
    project_start: Optional[date],
    project_end: Optional[date],
    start_value: Optional[date],
    due_value: Optional[date],
    start_field: str = "startDate",
    due_field: str = "dueDate",
) -> None:
    """
    Lève ValidationError si start/due sortent de [project_start, project_end]
    lorsque ces bornes projet sont définies.
    """
    if not project_start and not project_end:
        return

    if start_value is not None:
        if project_start and start_value < project_start:
            raise _bounds_error(start_field, "La date de debut doit etre posterieure ou egale au debut du projet.")
        if project_end and start_value > project_end:
            raise _bounds_error(start_field, "La date de debut doit etre anterieure ou egale a la fin du projet.")

    if due_value is not None:
        if project_start and due_value < project_start:
            raise _bounds_error(due_field, "L'echeance doit etre posterieure ou egale au debut du projet.")
        if project_end and due_value > project_end:
            raise _bounds_error(due_field, "L'echeance doit etre anterieure ou egale a la fin du projet.")

    if start_value is not None and due_value is not None and start_value > due_value:
        raise serializers.ValidationError(
            {start_field: "La date de debut doit etre anterieure ou egale a l'echeance.", due_field: "Incoherence avec la date de debut."}
        )


def validate_sprint_dates_within_project(project, start: Optional[date], end: Optional[date]) -> None:
    validate_against_project_window(
        project_start=project.start_date,
        project_end=project.end_date,
        start_value=start,
        due_value=end,
        start_field="startDate",
        due_field="endDate",
    )


def validate_milestone_due_within_project(project, due: Optional[date]) -> None:
    validate_against_project_window(
        project_start=project.start_date,
        project_end=project.end_date,
        start_value=None,
        due_value=due,
        due_field="dueDate",
    )
