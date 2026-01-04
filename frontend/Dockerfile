# syntax=docker/dockerfile:1

FROM node:18-bullseye AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV SSL_CERT_PATH=/etc/nginx/certs/fullchain.pem
ENV SSL_KEY_PATH=/etc/nginx/certs/privkey.pem
EXPOSE 80
EXPOSE 443
