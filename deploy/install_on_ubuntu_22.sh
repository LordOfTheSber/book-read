#!/usr/bin/env bash
# Installs Docker, builds images, and launches the application on Ubuntu 22.04 under the domain book.read.katernyuk.s.m using Docker containers.
# Run this script as root (or via sudo) on the target server.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${DOMAIN:-166.1.22.108}"
APP_SRC="${APP_SRC:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
APP_ROOT="${APP_ROOT:-${APP_SRC}}"
VITE_API_URL="${VITE_API_URL:-/api/v1}"
SPRING_DATASOURCE_URL="${SPRING_DATASOURCE_URL:-jdbc:postgresql://db:5432/library}"
SPRING_DATASOURCE_USERNAME="${SPRING_DATASOURCE_USERNAME:-library}"
SPRING_DATASOURCE_PASSWORD="${SPRING_DATASOURCE_PASSWORD:-library}"
SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"
POSTGRES_DB="${POSTGRES_DB:-library}"
POSTGRES_USER="${POSTGRES_USER:-library}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-library}"
CERT_DIR="${CERT_DIR:-${APP_ROOT}/deploy/certs}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
USE_LETSENCRYPT="${USE_LETSENCRYPT:-false}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This script must be run as root. Try again with sudo." >&2
  exit 1
fi

echo "Updating apt cache and installing base packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg lsb-release rsync

echo "Installing Docker Engine..."
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Syncing repository to ${APP_ROOT}..."
mkdir -p "${APP_ROOT}"
rsync -a --delete "${APP_SRC}/" "${APP_ROOT}/"

cd "${APP_ROOT}"

echo "Preparing TLS certificates in ${CERT_DIR}..."
mkdir -p "${CERT_DIR}"

if [[ "${USE_LETSENCRYPT}" == "true" && -n "${LETSENCRYPT_EMAIL}" ]]; then
  echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot
  certbot certonly --standalone --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" -d "${DOMAIN}"
  live_path="/etc/letsencrypt/live/${DOMAIN}"
  if [[ ! -f "${live_path}/fullchain.pem" || ! -f "${live_path}/privkey.pem" ]]; then
    echo "Let's Encrypt certificates not found at ${live_path}" >&2
    exit 1
  fi
  cp "${live_path}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
  cp "${live_path}/privkey.pem" "${CERT_DIR}/privkey.pem"
else
  echo "Generating self-signed certificate for ${DOMAIN}..."
  openssl req -x509 -nodes -newkey rsa:4096 -days 365 \
    -subj "/CN=${DOMAIN}" \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem"
fi

ENV_FILE="deploy/.env"
echo "Writing ${ENV_FILE}..."
cat >"${ENV_FILE}" <<EOF
DOMAIN=${DOMAIN}
VITE_API_URL=${VITE_API_URL}
SPRING_DATASOURCE_URL=${SPRING_DATASOURCE_URL}
SPRING_DATASOURCE_USERNAME=${SPRING_DATASOURCE_USERNAME}
SPRING_DATASOURCE_PASSWORD=${SPRING_DATASOURCE_PASSWORD}
SPRING_PROFILES_ACTIVE=${SPRING_PROFILES_ACTIVE}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SSL_CERT_PATH=/etc/nginx/certs/fullchain.pem
SSL_KEY_PATH=/etc/nginx/certs/privkey.pem
EOF

echo "Building Docker images..."
docker compose -f deploy/docker-compose.prod.yml --env-file "${ENV_FILE}" build

echo "Starting containers..."
docker compose -f deploy/docker-compose.prod.yml --env-file "${ENV_FILE}" up -d

echo "Deployment complete. Visit http://${DOMAIN}"
