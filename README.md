# Library Tracker

Full-stack application for tracking library items (books) with CRUD, filtering, and type management.

## Prerequisites
- Java 21
- Node.js 18+
- Maven
- Docker (for PostgreSQL)

## Running PostgreSQL
```bash
docker-compose up -d db
```
Database defaults:
- URL: `jdbc:postgresql://localhost:5432/library`
- User/Password: `library`

## Backend
Located in `/backend` (Spring Boot).

### Run
```bash
cd backend
mvn spring-boot:run
```

### Tests
```bash
cd backend
mvn test
```

## Frontend
Located in `/frontend` (Vite + React + Ant Design, FSD layout).

### Install deps
```bash
cd frontend
npm install
```

### Development server
```bash
npm run dev
```
The app expects API at `http://localhost:8080/api/v1`. Override with `VITE_API_URL`.

### Build
```bash
npm run build
```

## Ubuntu 22 deployment script (Docker)
Run the provided script as root (or via `sudo`) on the target server to build Docker images, start containers (frontend + backend + PostgreSQL), and expose the app at `https://book.read.katernyuk.s.m`:

```bash
sudo bash deploy/install_on_ubuntu_22.sh
```

> Tip: you can run the script from any folder (including `deploy/`); it automatically uses the repository root as the source path.

Tune behavior with environment variables:
- `DOMAIN` — domain for Nginx in the frontend container (default `book.read.katernyuk.s.m`).
- `APP_ROOT` — installation directory for the repo sync (default `/opt/book-read`).
- `APP_SRC` — path to the repository to deploy (default current directory).
- `VITE_API_URL` — API base path during frontend build (default `/api`).
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SPRING_PROFILES_ACTIVE` — backend environment.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — database configuration for the bundled PostgreSQL container.
- `USE_LETSENCRYPT=true` and `LETSENCRYPT_EMAIL=<you@example.com>` — issue a Let's Encrypt certificate (domain must resolve to the server); otherwise a self-signed certificate is generated.
- `CERT_DIR` — where certificates are stored and mounted into the frontend container (default `${APP_ROOT}/deploy/certs`).
