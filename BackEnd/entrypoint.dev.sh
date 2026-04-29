#!/usr/bin/env bash
set -euo pipefail

python manage.py migrate_schemas --shared --noinput
python manage.py migrate_schemas --noinput
python manage.py sync_world_data --if-empty

exec python manage.py runserver 0.0.0.0:8000
