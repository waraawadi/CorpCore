# CorpCore - Workspace

## Lancement interactif Docker

Utilise le script interactif racine:

```bash
./scripts/launch.sh
```

Il permet de choisir:

- mode `dev` (Next.js + Django dev)
- mode `prod` (Nginx + Next build + Gunicorn)
- action (`up`, `down`, `logs`, `ps`, `restart`)

Mode non interactif:

```bash
./scripts/launch.sh dev up
./scripts/launch.sh prod up
./scripts/launch.sh dev logs
./scripts/launch.sh prod down
```

## Fichiers compose

- `docker-compose.dev.yml`: stack complete dev (Django dev, Next.js hot-reload, DB, Redis, Celery, OnlyOffice)
- `docker-compose.prod.yml`: stack complete prod (Django/Gunicorn, Next build + Nginx, DB, Redis, Celery, OnlyOffice)
- les deux modes sont relies au reseau externe Nginx Proxy Manager `proxy` (ou `PROXY_NETWORK`)

## Deploiement avec Nginx Proxy Manager (dev + prod)

Les deux modes utilisent directement Nginx Proxy Manager:

```bash
./scripts/launch.sh dev up
./scripts/launch.sh prod up
```

- reseau NPM utilise (modifiable): `PROXY_NETWORK=proxy`
- le launcher cree automatiquement ce reseau Docker s'il n'existe pas.

### Cibles recommandees dans Nginx Proxy Manager

- **dev**
  - frontend: `corpcore_frontend_dev:3000`
  - backend API (si route separee): `corpcore_backend:8000`
  - onlyoffice: `corpcore_onlyoffice:80`
- **prod**
  - app (recommande): `corpcore_nginx:80` (garde le routage `/` et `/api` centralise)
  - onlyoffice (domaine dedie optionnel): `corpcore_onlyoffice:80`

## Wildcard `*.local` sur ta machine (DNS)

`/etc/hosts` ne supporte pas les jokers : une ligne `127.0.0.1 *.local` ne cree pas un wildcard.

Pour que **n'importe quel** `quelquechose.local` resolve vers `127.0.0.1` :

```bash
sudo ./scripts/setup-wildcard-local-dns.sh
```

Le script installe **dnsmasq**, copie `infra/dnsmasq/corpcore-wildcard-local.conf` (`address=/.local/127.0.0.1`), et desactive le stub DNS de **systemd-resolved** sur le port 53 pour liberer `127.0.0.1`.

**Attention** : le suffixe `.local` est aussi utilise par **mDNS (Avahi)**. En cas de conflit, un TLD de dev du type `.test` est plus neutre.
