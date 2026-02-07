# syntax=docker/dockerfile:1

FROM node:18-bullseye AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && cat >/docker-entrypoint.d/05-generate-certs.sh <<'EOF'
#!/bin/sh
set -e
: "${SSL_CERT_PATH:=/etc/nginx/certs/fullchain.pem}"
: "${SSL_KEY_PATH:=/etc/nginx/certs/privkey.pem}"
: "${DOMAIN:=localhost}"
if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
  exit 0
fi
mkdir -p "$(dirname "$SSL_CERT_PATH")" "$(dirname "$SSL_KEY_PATH")"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -subj "/CN=${DOMAIN}" \
  -keyout "$SSL_KEY_PATH" \
  -out "$SSL_CERT_PATH"
EOF
RUN chmod +x /docker-entrypoint.d/05-generate-certs.sh
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV SSL_CERT_PATH=/etc/nginx/certs/fullchain.pem
ENV SSL_KEY_PATH=/etc/nginx/certs/privkey.pem
EXPOSE 80
EXPOSE 9443
