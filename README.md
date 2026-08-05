# Library Tracker

Full-stack application for tracking library items (books) with CRUD, filtering, and type management.

## Prerequisites
- Java 21
- Node.js 18+
- Maven
- Docker (for PostgreSQL)

## Running PostgreSQL
The compose file has no built-in password: copy the sample env file and set one before the first run.

```bash
cp .env.example .env   # then fill POSTGRES_PASSWORD / DB_PASSWORD
docker-compose up -d db
```
Database defaults:
- URL: `jdbc:postgresql://localhost:5432/library` (published on `127.0.0.1` only)
- Database and user: `library`
- Password: taken from `POSTGRES_PASSWORD`; `docker-compose up` fails if it is empty

`.env` is git-ignored — no credential in this repository is a working one.

## Backend
Located in `/backend` (Spring Boot).

### Security configuration
| Variable | Default | Description |
|---|---|---|
| `SECURITY_JWT_SECRET` | — | JWT signing key, at least 32 bytes. **Required in the `prod` profile**: the application refuses to start without it. Outside `prod` an ephemeral key is generated per start (tokens do not survive a restart). Generate with `openssl rand -base64 48`. |
| `SECURITY_JWT_EXPIRATION_MS` | `1800000` (30 min) | Access token lifetime. Clients renew it via `POST /api/v1/auth/refresh` using the server-side session cookie. |
| `SECURITY_COOKIE_SECURE` | `false` (`true` in `prod`) | `Secure` flag of the auth cookies. Keep `true` behind TLS. |
| `SECURITY_COOKIE_SAME_SITE` | `Lax` | `SameSite` attribute of the auth cookies. Do not relax it to `None` without adding CSRF tokens: both cookies are sent automatically by the browser. |

Authentication uses two httpOnly cookies and no client-side storage:

- `SESSION_ID` — the server-side session; `POST /api/v1/auth/refresh` renews the access token from it.
- `ACCESS_TOKEN` — the JWT itself. It is never returned in a response body, so XSS cannot read it.

`Authorization: Bearer <token>` is still accepted for non-browser clients (curl, integration tests).

The deployment scripts generate `SECURITY_JWT_SECRET` when it is not supplied and reuse the previously
deployed value on subsequent runs — changing the key signs every user out.

### Run
```bash
cd backend
mvn spring-boot:run
```

### Database migrations
Flyway runs on startup and validates that every applied migration still matches the file it came from.
A mismatch aborts the boot with `Migration checksum mismatch for migration version N` — the application
refuses to run against a schema whose history it cannot trust.

```bash
export DB_URL=jdbc:postgresql://localhost:5432/library DB_USER=library DB_PASSWORD=...
mvn flyway:info      # what is applied, and what is pending
mvn flyway:repair    # realign checksums with the current files
```

`repair` only rewrites the history table; it does not re-run any SQL. Use it when the applied migration
did the same thing as the current file (a comment was reformatted, a dev database saw an intermediate
version of a branch). If the applied migration was genuinely different, the schema may be missing
objects — on a development database it is safer to drop it and let all migrations run from scratch.

### Tests
```bash
cd backend
mvn test
```
Integration tests run against PostgreSQL 16 in Testcontainers, with the schema built by Flyway — the same
migrations the production database gets. They need a working Docker daemon; without one they are reported as
skipped rather than failing, and CI checks `docker version` before the test step so a skip cannot pass silently.

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

### Lint, type check and build
```bash
npm run lint
npm run typecheck
npm run build
```
`npm run build` is a plain `vite build` without type checking, so `npm run typecheck` is a separate step.

### Tests
```bash
npm run test        # Vitest + Testing Library: Redux slices and forms
npm run test:e2e    # Playwright: full stack in a real browser
```
The e2e run needs a built backend jar and a database, and starts both servers itself:

```bash
mvn -f ../backend/pom.xml package -DskipTests
DB_URL=jdbc:postgresql://localhost:5432/library DB_USER=library DB_PASSWORD=... npm run test:e2e
```
Playwright installs its own Chromium (`npx playwright install chromium`). If the machine already has one
from another source, point at it with `E2E_CHROMIUM_PATH`.

## Cover storage
Covers live in object storage, not in the database — unlike avatars, which are stored as compressed blobs.

| Variable | Default | Description |
|---|---|---|
| `STORAGE_TYPE` | `filesystem` | `filesystem` or `s3`. The filesystem backend needs no setup but is local to one replica. |
| `STORAGE_PATH` | `storage` | Directory for the filesystem backend. |
| `STORAGE_S3_BUCKET` | — | Bucket name; required when `STORAGE_TYPE=s3`. |
| `STORAGE_S3_REGION` | `us-east-1` | Region. |
| `STORAGE_S3_ENDPOINT` | — | Set for S3-compatible services (MinIO, Ceph); leave empty for AWS. |
| `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY` | — | Leave empty to use the default AWS credential chain (instance role, environment, profile). |
| `STORAGE_S3_PATH_STYLE` | `true` | Path-style addressing; usually required by non-AWS implementations. |

## Metrics and health
Actuator is enabled on the application port:

- `GET /actuator/health` (plus `/health/liveness` and `/health/readiness`) — public, used by the Kubernetes probes.
- `GET /actuator/prometheus` and `GET /actuator/metrics` — `ADMIN`/`SUPER_ADMIN` only. Every meter carries
  `application="book-read-backend"` and a `node` tag matching the node key shown on the Nodes page.

The built-in monitoring pages read counters a replica keeps in memory: they are per-pod and reset when that pod
restarts. For figures summed across replicas, or for any history, scrape `/actuator/prometheus` — Prometheus
aggregates by tag and keeps the series.

## Continuous integration
`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and `release/**`:

- **Backend** — `mvn test` (unit tests plus Testcontainers integration tests).
- **Frontend** — `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **E2E** — Playwright against a real backend and a PostgreSQL service container; the report is
  uploaded as an artifact when the job fails.

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
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SPRING_PROFILES_ACTIVE` — backend environment. The password defaults to `POSTGRES_PASSWORD`, since the backend talks to the bundled database.
- `SECURITY_JWT_SECRET` — JWT signing key; generated on the first run and reused from `deploy/.env` afterwards.
- `SECURITY_COOKIE_SECURE` — `Secure` flag of the auth cookies (default `true`; the deployment terminates TLS).
- `POSTGRES_DB`, `POSTGRES_USER` — database name and user for the bundled PostgreSQL container (default `library`).
- `POSTGRES_PASSWORD` — database password. **No default**: it is reused from `deploy/.env` or generated on the first run, the same way as the JWT secret. PostgreSQL only applies it when the volume is initialised, so if `deploy/.env` is lost while the volume survives, pass the original password explicitly.
- `USE_LETSENCRYPT=true` and `LETSENCRYPT_EMAIL=<you@example.com>` — issue a Let's Encrypt certificate (domain must resolve to the server); otherwise a self-signed certificate is generated.
- `CERT_DIR` — where certificates are stored and mounted into the frontend container (default `${APP_ROOT}/deploy/certs`).

## Kubernetes deployment
The Kubernetes rollout is automated via a script that builds images, loads or pushes them, renders manifests, and applies them to the cluster.
If `kubectl` or `docker` are missing, the script attempts to install them via `apt` (requires sudo/root).
The script applies manifests with validation disabled to avoid OpenAPI fetch failures on local clusters.

### Run
```bash
./deploy/install_k8s.sh
```

### Defaults and overrides
You can tune the rollout using environment variables:
- `NAMESPACE` — Kubernetes namespace to create/use (default `book-read`).
- `DOMAIN` — domain for the frontend TLS certificate (default `23.26.124.71`).
- `VITE_API_URL` — API base path for the frontend build (default `/api/v1`).
- `SPRING_PROFILES_ACTIVE` — backend Spring profile (default `prod`).
- `SECURITY_JWT_SECRET` — JWT signing key; generated on the first rollout and reused from the `book-read-backend` Secret afterwards.
- `SECURITY_COOKIE_SECURE` — `Secure` flag of the auth cookies (default `true`).
- `POSTGRES_DB`, `POSTGRES_USER` — database name and user (default `library`).
- `POSTGRES_PASSWORD` — database password. **No default**: it is read from the existing `book-read-db` Secret or generated on the first rollout.
- `DB_STORAGE_SIZE` — PVC size for PostgreSQL (default `1Gi`).
- `BACKEND_REPLICAS`, `FRONTEND_REPLICAS` — deployment sizes (default `2` for backend, `1` for frontend).
- `FRONTEND_SERVICE_TYPE` — Service type for the frontend (`ClusterIP` by default).
- `IMAGE_TAG` — Docker tag for built images (default `local`).
- `IMAGE_REGISTRY` — registry to push images to (when set, images are pushed and pulled from this registry).
- `ROLLOUT_TIMEOUT` — rollout wait timeout (default `180s`).
- `SKIP_CLUSTER_CHECK` — skip the pre-flight `kubectl cluster-info` check (default `false`).
If no current kubectl context is configured and only one context exists, the script auto-selects it. When no contexts exist, it will try to use a local k3s kubeconfig (`/etc/rancher/k3s/k3s.yaml`) and its current context, then select a running `kind` or `minikube` context automatically.

### Access
If you are running with `ClusterIP` (default), consider port-forwarding:
```bash
kubectl port-forward service/frontend 8080:80 -n book-read
```
For HTTPS access, forward port 9443:
```bash
kubectl port-forward service/frontend 9443:9443 -n book-read
```
