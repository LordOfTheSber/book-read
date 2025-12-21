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
