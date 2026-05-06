#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker est requis mais introuvable."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin 'docker compose' est requis."
  exit 1
fi

ensure_env_file() {
  local file_path="$1"
  local example_path="$2"
  if [ ! -f "$file_path" ] && [ -f "$example_path" ]; then
    cp "$example_path" "$file_path"
    echo "Fichier cree: $file_path (depuis $example_path)"
  fi
}

ensure_env_file "$ROOT_DIR/BackEnd/.env" "$ROOT_DIR/BackEnd/.env.example"
ensure_env_file "$ROOT_DIR/FrontEnd/.env" "$ROOT_DIR/FrontEnd/.env.example"

compose_files_for_mode() {
  local mode="$1"
  if [ "$mode" = "prod" ]; then
    echo "-f docker-compose.prod.yml"
  else
    echo "-f docker-compose.dev.yml"
  fi
}

run_compose() {
  local mode="$1"
  shift
  local files
  files="$(compose_files_for_mode "$mode")"
  # shellcheck disable=SC2086
  docker compose $files "$@"
}

ensure_npm_network() {
  local npm_network="${PROXY_NETWORK:-proxy}"
  if ! docker network inspect "$npm_network" >/dev/null 2>&1; then
    echo "Creation du reseau Docker pour Nginx Proxy Manager: $npm_network"
    docker network create "$npm_network" >/dev/null
  fi
}

post_up_bootstrap() {
  local mode="$1"
  echo "Attente du backend..."
  for _ in {1..30}; do
    if run_compose "$mode" exec -T backend python manage.py check >/dev/null 2>&1; then
      echo "Backend pret."
      break
    fi
    sleep 2
  done

  echo "Bootstrap automatique des donnees necessaires..."
  run_compose "$mode" exec -T backend python manage.py migrate_schemas --shared --noinput || true
  run_compose "$mode" exec -T backend python manage.py migrate_schemas --noinput || true
  run_compose "$mode" exec -T backend python manage.py sync_world_data --if-empty || true
}

run_action() {
  local mode="$1"
  local action="$2"
  shift 2
  case "$action" in
    up) ensure_npm_network && run_compose "$mode" up -d --build "$@" && post_up_bootstrap "$mode" ;;
    stop) run_compose "$mode" stop "$@" ;;
    down) run_compose "$mode" down "$@" ;;
    logs) run_compose "$mode" logs -f "$@" ;;
    ps) run_compose "$mode" ps "$@" ;;
    restart) run_compose "$mode" restart "$@" ;;
    superuser) run_compose "$mode" exec backend python manage.py createsuperuser "$@" ;;
    *) echo "Action invalide: $action" && return 1 ;;
  esac
}

if [ $# -ge 2 ]; then
  MODE="$1"
  ACTION="$2"
  shift 2
  run_action "$MODE" "$ACTION" "$@"
  exit 0
fi

while true; do
  echo "==============================="
  echo "      CorpCore Launcher"
  echo "==============================="
  echo ""
  echo "Choisis le mode:"
  echo "  1) dev  (frontend Next.js hot reload + backend dev)"
  echo "  2) prod (frontend build + nginx + backend gunicorn, via NPM)"
  echo "  9) quitter"
  read -rp "Mode [1-2-9]: " mode_choice

  case "${mode_choice:-1}" in
    1) MODE="dev" ;;
    2) MODE="prod" ;;
    9) echo "A bientot."; exit 0 ;;
    *) echo "Choix invalide."; echo ""; continue ;;
  esac

  while true; do
    echo ""
    echo "Mode actif: $MODE (NPM=1)"
    echo "Choisis l'action:"
    echo "  1) up          (build + start)"
    echo "  2) stop        (stop sans supprimer les volumes)"
    echo "  3) down        (stop + remove)"
    echo "  4) logs        (stream logs)"
    echo "  5) ps          (list services)"
    echo "  6) restart     (restart services)"
    echo "  7) superuser   (creer un superuser Django)"
    echo "  0) retour      (changer de mode)"
    echo "  9) quitter"
    read -rp "Action [0-7-9]: " action_choice

    case "${action_choice:-4}" in
      1) ACTION="up" ;;
      2) ACTION="stop" ;;
      3) ACTION="down" ;;
      4) ACTION="logs" ;;
      5) ACTION="ps" ;;
      6) ACTION="restart" ;;
      7) ACTION="superuser" ;;
      0) break ;;
      9) echo "A bientot."; exit 0 ;;
      *) echo "Choix invalide."; continue ;;
    esac

    echo ""
    echo "Execution: mode=$MODE action=$ACTION"
    run_action "$MODE" "$ACTION"

    echo ""
    read -rp "Action terminee. Appuie sur Entree pour continuer..." _
  done
done
