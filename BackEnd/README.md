# CorpCore BackEnd (Django Multi-Tenant)

Backend foundation for CorpCore ERP SaaS using:

- Django 5.x + DRF + Simple JWT
- `django-tenants` (PostgreSQL schema isolation)
- PostgreSQL 15 + Redis + Celery
- OpenAPI docs with drf-spectacular

## Quick start

1. Copy env file:

```bash
cp .env.example .env
```

2. Build and run:

```bash
docker compose up --build
```

3. API docs:

- `http://localhost:8000/api/docs/swagger/`
- `http://localhost:8000/api/docs/redoc/`

## Tenant routing

- Public schema onboarding endpoint: `POST /api/public/onboarding/`
- Tenant-aware API base: `/api/`

### Onboarding entreprise (auto)

Le endpoint `POST /api/public/onboarding/` cree automatiquement:

- l'entreprise (tenant + schema + sous-domaine)
- le profil legal de l'entreprise
- le compte admin de l'entreprise
- un essai gratuit de 30 jours avec tous les modules actifs

Exemple de champs attendus:

- `company_name`, `slug`
- `admin_email`, `admin_phone`, `admin_password`, `first_name`, `last_name`
- `legal_name`, `registration_number`, `tax_identification_number`
- `country`, `city`, `address_line`, `postal_code`
- `company_email`, `company_phone`
- `representative_full_name`, `representative_role`, `representative_id_number`

### World data (pays / villes)

Le backend expose des endpoints publics de recherche:

- `GET /api/public/world/countries/?q=&limit=`
- `GET /api/public/world/cities/?country=CI&q=&limit=`

Les donnees sont chargees automatiquement au demarrage via `sync_world_data --if-empty`.

## Implemented foundations

- Multi-tenant tenant/domain models (`tenants`)
- Subscription catalog and tenant subscriptions (`subscriptions`)
- Full first version of project management domain (`projects`)
- REST routing for projects/tasks/subtasks/sprints/milestones/comments/attachments/time/dependencies
- JWT tenant-aware endpoints and health checks

## Auth endpoints

- `POST /api/auth/token/` (JWT with tenant context)
- `POST /api/auth/token/refresh/`
- `GET /api/auth/me/`

## Billing endpoints (tenant)

- `GET /api/billing/modules/`
- `GET /api/billing/subscriptions/`
- `POST /api/billing/payments/initiate/`
- `POST /api/billing/payments/sync/`
- `POST /api/billing/payments/webhook/`

`/api/billing/payments/initiate/` accepte:

- `module_id` (single)
- ou `module_ids` (liste) pour un paiement groupe (montant total des modules selectionnes)
