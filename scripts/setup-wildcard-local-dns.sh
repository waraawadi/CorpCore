#!/usr/bin/env bash
# Configure local wildcard DNS: any *.local -> 127.0.0.1 (via dnsmasq).
# Requires sudo. Tested on Debian/Ubuntu-style systems with dnsmasq package.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SRC="${ROOT_DIR}/infra/dnsmasq/corpcore-wildcard-local.conf"
CONF_DST="/etc/dnsmasq.d/corpcore-wildcard-local.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relance avec sudo: sudo $0"
  exit 1
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Fichier manquant: $CONF_SRC"
  exit 1
fi

if ! command -v dnsmasq >/dev/null 2>&1; then
  echo "Installation de dnsmasq..."
  apt-get update -qq
  apt-get install -y dnsmasq
fi

cp -a "$CONF_SRC" "$CONF_DST"
chmod 644 "$CONF_DST"

echo "Configuration copiee: $CONF_DST"

# systemd-resolved often binds 127.0.0.53; dnsmasq can listen on 127.0.0.1 only.
if [[ -d /etc/systemd/resolved.conf.d ]]; then
  cat >/etc/systemd/resolved.conf.d/corpcore-dnsmasq.conf <<'EOF'
[Resolve]
# Let dnsmasq own 127.0.0.1:53; resolved keeps stub on 127.0.0.53 if needed.
DNSStubListener=no
EOF
  systemctl restart systemd-resolved
  echo "systemd-resolved: DNSStubListener=no (redemarre)."
fi

# dnsmasq: listen only on loopback
if grep -q '^listen-address=' /etc/dnsmasq.conf 2>/dev/null; then
  :
else
  printf '\n# CorpCore local wildcard\nlisten-address=127.0.0.1\nbind-interfaces\n' >>/etc/dnsmasq.conf
fi

systemctl enable dnsmasq
systemctl restart dnsmasq

echo ""
echo "OK. Teste:"
echo "  dig +short corpcore.local @127.0.0.1"
echo "  dig +short foo.bar.local @127.0.0.1"
echo ""
echo "Si le navigateur ne resout pas encore, configure NetworkManager pour utiliser 127.0.0.1 comme DNS,"
echo "ou ajoute dans /etc/resolv.conf (via systemd-resolved): nameserver 127.0.0.1"
