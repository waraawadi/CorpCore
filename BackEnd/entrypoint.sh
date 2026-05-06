#!/usr/bin/env bash
set -euo pipefail

python manage.py migrate_schemas --shared --noinput
python manage.py migrate_schemas --noinput
python manage.py sync_world_data --if-empty
python manage.py collectstatic --noinput

exec gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
