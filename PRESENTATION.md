# Library Tracker
## Система управления библиотекой

---

# Слайд 1: Титульный слайд

## 📚 Library Tracker v2.0

**Полнофункциональная система управления библиотекой**

- Full-Stack веб-приложение
- Современный технологический стек
- Готовое к продакшену решение

**Release 02.000.000**

---

# Слайд 2: Обзор проекта

## Что это?

Веб-приложение для учёта книг и медиа-контента с:

- ✅ Многопользовательским доступом
- ✅ Системой ролей и разрешений
- ✅ Расширенным поиском и фильтрацией
- ✅ Аналитикой и статистикой
- ✅ Мониторингом системы
- ✅ Экспортом/импортом данных
- ✅ Docker-развертыванием

---

# Слайд 3: Технологический стек

## Backend

| Компонент | Технология |
|-----------|------------|
| Язык | **Java 21** |
| Фреймворк | **Spring Boot 3.4.4** |
| База данных | **PostgreSQL 16** |
| Миграции | **Flyway** |
| Безопасность | **Spring Security + JWT** |

## Frontend

| Компонент | Технология |
|-----------|------------|
| Сборщик | **Vite 5.2** |
| Фреймворк | **React 18** |
| UI-библиотека | **Ant Design 5** |
| Стейт-менеджмент | **Redux Toolkit 2.2** |
| Роутинг | **React Router 6** |

---

# Слайд 4: Архитектура приложения

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  Pages  │  │ Widgets │  │Features │  │    Entities     │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
│       └────────────┴────────────┴────────────────┘          │
│                         │                                    │
│                    React + Redux                             │
└─────────────────────────┼───────────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────┼───────────────────────────────────┐
│                        BACKEND                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Controllers │──│  Services   │──│    Repositories     │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                                                │             │
│                   Spring Boot + JPA            │             │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
┌────────────────────────────────────────────────┼─────────────┐
│                      DATABASE                  │             │
│                    PostgreSQL 16               │             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  users   │ │  items   │ │  types   │ │ sources  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Паттерн**: Feature-Sliced Design (FSD) на фронтенде

---

# Слайд 5: Структура базы данных

## ER-диаграмма

```
┌─────────────────┐       ┌─────────────────────────────────────┐
│     users       │       │           library_items             │
├─────────────────┤       ├─────────────────────────────────────┤
│ id (UUID) PK    │───┐   │ id (UUID) PK                        │
│ username        │   │   │ kind (BOOK)                         │
│ password        │   │   │ title                               │
│ role            │   │   │ alt_title                           │
│ avatar          │   └──►│ created_by FK                       │
│ blocked         │       │ type_id FK ───────────────────┐     │
│ session_ttl     │       │ source_id FK ─────────────┐   │     │
│ created_at      │       │ status, rating, favorite  │   │     │
│ updated_at      │       │ comment                   │   │     │
└─────────────────┘       │ created_at, updated_at    │   │     │
                          └───────────────────────────┼───┼─────┘
┌─────────────────┐                                   │   │
│    sources      │◄──────────────────────────────────┘   │
├─────────────────┤                                       │
│ id (UUID) PK    │       ┌─────────────────┐            │
│ name            │       │   book_types    │◄───────────┘
│ url             │       ├─────────────────┤
│ description     │       │ id (UUID) PK    │
│ created_at      │       │ name            │
│ updated_at      │       │ created_at      │
└─────────────────┘       │ updated_at      │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────────────────────────┐
│    sessions     │       │           system_nodes              │
├─────────────────┤       ├─────────────────────────────────────┤
│ id (UUID) PK    │       │ id (UUID) PK                        │
│ user_id FK      │       │ node_key (UNIQUE)                   │
│ expires_at      │       │ hostname, ip, port                  │
│ max_expires_at  │       │ cpu_load, memory_*, heap_*, disk_*  │
│ created_at      │       │ uptime_seconds                      │
│ updated_at      │       │ last_reported_at                    │
└─────────────────┘       └─────────────────────────────────────┘
```

---

# Слайд 6: Flyway миграции

## 7 миграций для эволюции схемы БД

| Версия | Описание | Ключевые изменения |
|--------|----------|-------------------|
| **V1** | Initial Schema | `library_items`, `book_types`, индексы |
| **V2** | Sources | Таблица `sources`, FK к items |
| **V3** | User Ownership | Таблица `users`, роли, FK к items |
| **V4** | User Avatars | Поля `avatar` (BYTEA), `content_type` |
| **V5** | System Nodes | Мониторинг системы |
| **V6** | Sessions | Управление сессиями с TTL |
| **V7** | User Blocking | Блокировка пользователей, SUPER_ADMIN |

## Пример миграции V1:

```sql
CREATE TABLE library_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        VARCHAR(50) NOT NULL,
    title       VARCHAR(512) NOT NULL,
    alt_title   VARCHAR(512),
    type_id     UUID REFERENCES book_types(id),
    status      VARCHAR(50) DEFAULT 'PLANNED',
    rating      NUMERIC(3,1) CHECK (rating BETWEEN 0 AND 10),
    favorite    BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_library_items_title ON library_items(LOWER(title));
CREATE INDEX idx_library_items_status ON library_items(status);
CREATE INDEX idx_library_items_favorite ON library_items(favorite);
```

---

# Слайд 7: Система ролей (RBAC)

## 4 уровня доступа

```
┌───────────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                               │
│  ✓ Полный доступ к системе                                    │
│  ✓ Экспорт/импорт данных                                      │
│  ✓ Блокировка пользователей                                   │
│  ✓ Скачивание логов системы                                   │
├───────────────────────────────────────────────────────────────┤
│                         ADMIN                                  │
│  ✓ Управление пользователями                                  │
│  ✓ Мониторинг системы (nodes)                                 │
│  ✓ Удаление типов и источников                                │
├───────────────────────────────────────────────────────────────┤
│                        EDITOR                                  │
│  ✓ Создание/редактирование типов книг                         │
│  ✓ Создание/редактирование источников                         │
├───────────────────────────────────────────────────────────────┤
│                         USER                                   │
│  ✓ CRUD своих книг                                            │
│  ✓ Просмотр аналитики                                         │
│  ✓ Просмотр типов и источников                                │
└───────────────────────────────────────────────────────────────┘
```

## Реализация в Spring Security

```java
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteBookType(@PathVariable UUID id) {
    bookTypeService.delete(id);
    return ResponseEntity.noContent().build();
}
```

---

# Слайд 8: REST API эндпоинты

## Основные группы API

### Аутентификация (`/api/v1/auth`)
```
POST /login     - Вход (JWT + Cookie)
POST /register  - Регистрация
```

### Книги (`/api/v1/items`)
```
GET    /                - Список с фильтрацией и пагинацией
GET    /{id}            - Детали книги
POST   /                - Создание (USER+)
PUT    /{id}            - Обновление (USER+)
DELETE /{id}            - Удаление (USER+)
```

### Аналитика (`/api/v1/analytics`)
```
GET /books              - Статистика по книгам
```

### Администрирование
```
/api/v1/users           - Управление пользователями
/api/v1/nodes           - Мониторинг системы
/api/v1/exports         - Экспорт/импорт данных
```

---

# Слайд 9: Расширенная фильтрация

## Возможности поиска книг

```
GET /api/v1/items?q=Толстой
                 &typeId=uuid
                 &status=READING
                 &favorite=true
                 &minRating=7.5
                 &maxRating=10
                 &createdFrom=2024-01-01
                 &createdTo=2024-12-31
                 &userId=uuid
                 &page=0
                 &size=20
                 &sort=rating,desc
```

## Интересное решение: динамические JPA Specification

```java
public Specification<LibraryItem> buildSpecification(ItemFilterRequest filter) {
    return (root, query, cb) -> {
        List<Predicate> predicates = new ArrayList<>();

        if (filter.getQ() != null) {
            String pattern = "%" + filter.getQ().toLowerCase() + "%";
            predicates.add(cb.or(
                cb.like(cb.lower(root.get("title")), pattern),
                cb.like(cb.lower(root.get("altTitle")), pattern)
            ));
        }

        if (filter.getMinRating() != null) {
            predicates.add(cb.greaterThanOrEqualTo(
                root.get("rating"), filter.getMinRating()
            ));
        }

        // ... остальные фильтры

        return cb.and(predicates.toArray(new Predicate[0]));
    };
}
```

---

# Слайд 10: Аутентификация и сессии

## Двойная система аутентификации

```
┌─────────────────────────────────────────────────────────────┐
│                     JWT Token                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Header: { alg: "HS256", typ: "JWT" }                │    │
│  │ Payload: { sub: "username", exp: timestamp }        │    │
│  │ Signature: HMAC-SHA256(header.payload, secret)      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          +                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ HTTP-Only Cookie с Session ID                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Управление сессиями с Guava Cache

```java
private final Cache<UUID, Session> sessionCache = CacheBuilder.newBuilder()
    .maximumSize(10_000)           // Max 10K сессий
    .expireAfterWrite(2, TimeUnit.DAYS)  // TTL 2 дня
    .build();

// Двойной таймаут:
// 1. sessionTtlMinutes - idle timeout (по умолчанию 30 мин)
// 2. maxSessionLifetimeMinutes - абсолютный max (по умолчанию 24ч)
```

---

# Слайд 11: Frontend архитектура (FSD)

## Feature-Sliced Design

```
frontend/src/
├── app/                    # Инициализация приложения
│   ├── router/             # Конфигурация роутов
│   └── providers/          # Redux Store, Theme
│
├── pages/                  # Страницы (UI + логика)
│   ├── books-page/         # Главная - список книг
│   ├── analytics-page/     # Статистика
│   ├── users-page/         # Управление пользователями
│   ├── nodes-page/         # Мониторинг системы
│   └── node-detail-page/   # Детали ноды
│
├── widgets/                # Сложные UI-компоненты
│   ├── books-table/        # Таблица с CRUD
│   └── filters-panel/      # Панель фильтров
│
├── features/               # Фичи
│   └── book/set-book-filters/
│
├── entities/               # Бизнес-сущности + API
│   ├── book/               # API + Redux slice
│   ├── auth/               # Аутентификация
│   └── node/               # Мониторинг
│
└── shared/                 # Общие утилиты
    ├── api/                # HTTP-клиент
    ├── types/              # TypeScript интерфейсы
    └── ui/                 # Переиспользуемые компоненты
```

---

# Слайд 12: Redux Store структура

## Централизованное управление состоянием

```typescript
interface RootState {
  auth: {
    token: string | null;
    user: User | null;
    loadingUser: boolean;
    error: string | null;
  };

  books: {
    items: LibraryItem[];
    page: number;
    size: number;
    total: number;
    loading: boolean;
  };

  bookFilters: {
    q: string;
    typeId: string;
    status: ReadingStatus;
    favorite: boolean;
    minRating: number;
    maxRating: number;
    sort: string;
    page: number;
  };

  nodes: {
    list: SystemNode[];
    loading: boolean;
    error: string | null;
  };

  analytics: {
    data: BookAnalytics | null;
    loading: boolean;
  };
}
```

---

# Слайд 13: Мониторинг системы

## Сбор метрик в реальном времени

```java
@Scheduled(fixedRateString = "${node.heartbeat-interval:10000}")
public void captureNodeSnapshot() {
    SystemNodeSnapshot snapshot = new SystemNodeSnapshot();

    // CPU нагрузка
    OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
    snapshot.setCpuLoad(osBean.getSystemLoadAverage());

    // Системная память
    Runtime runtime = Runtime.getRuntime();
    snapshot.setSystemMemoryTotal(runtime.totalMemory());
    snapshot.setSystemMemoryFree(runtime.freeMemory());

    // JVM Heap
    MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
    MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
    snapshot.setHeapUsed(heapUsage.getUsed());
    snapshot.setHeapMax(heapUsage.getMax());

    // Дисковое пространство
    File root = new File("/");
    snapshot.setDiskTotal(root.getTotalSpace());
    snapshot.setDiskFree(root.getFreeSpace());

    nodeRepository.save(snapshot);
}
```

## Топ процессов по памяти (через PS)

```java
ProcessBuilder pb = new ProcessBuilder(
    "ps", "aux", "--sort=-rss"
);
// Парсинг вывода для топ-10 процессов
```

---

# Слайд 14: Экспорт/Импорт данных

## Полный бэкап базы данных в JSON

```java
@PostMapping
@PreAuthorize("hasRole('SUPER_ADMIN')")
public ResponseEntity<ExportResponse> exportData() {
    // Сериализация всех таблиц
    ExportData data = new ExportData();
    data.setUsers(userRepository.findAll());
    data.setBookTypes(bookTypeRepository.findAll());
    data.setSources(sourceRepository.findAll());
    data.setLibraryItems(libraryItemRepository.findAll());
    data.setExportedAt(Instant.now());

    // Сохранение в файл с timestamp
    String filename = "export_" + timestamp + ".json";
    objectMapper.writeValue(new File(exportDir, filename), data);

    return ResponseEntity.ok(new ExportResponse(filename));
}
```

## Формат экспорта

```json
{
  "exportedAt": "2026-01-08T10:30:00Z",
  "users": [...],
  "bookTypes": [...],
  "sources": [...],
  "libraryItems": [...]
}
```

## Восстановление из бэкапа

```
POST /api/v1/exports/{fileName}/restore
```

---

# Слайд 15: Docker архитектура

## Multi-stage сборка Backend

```dockerfile
# Stage 1: Сборка
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -DskipTests package

# Stage 2: Runtime (только JRE)
FROM eclipse-temurin:21-jre
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

## Multi-stage сборка Frontend

```dockerfile
# Stage 1: Сборка
FROM node:18 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api/v1
RUN npm run build

# Stage 2: Nginx
FROM nginx:1.27-alpine
# Автогенерация self-signed сертификатов
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 \
    -newkey rsa:4096 -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem -subj "/CN=localhost"
COPY --from=build /app/dist /usr/share/nginx/html
```

---

# Слайд 16: Docker Compose (Production)

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: library
      POSTGRES_USER: library
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U library"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/library
      SPRING_DATASOURCE_USERNAME: library
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      SPRING_PROFILES_ACTIVE: prod
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: /api/v1
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./certs:/etc/nginx/certs:ro

volumes:
  db_data:
```

---

# Слайд 17: Скрипт развертывания на Ubuntu 22

## Автоматизированная установка

```bash
#!/bin/bash
# deploy/install_on_ubuntu_22.sh

# 1. Проверка прав root
if [[ $EUID -ne 0 ]]; then
   echo "Запустите скрипт от root"
   exit 1
fi

# 2. Установка Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# 3. Клонирование/синхронизация проекта
rsync -av --exclude='.git' . ${APP_ROOT:-/opt/book-read}/

# 4. Генерация SSL сертификатов
if [[ "$USE_LETSENCRYPT" == "true" ]]; then
    certbot certonly --standalone -d $DOMAIN -m $EMAIL --agree-tos
else
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:4096 \
        -keyout certs/key.pem \
        -out certs/cert.pem \
        -subj "/CN=$DOMAIN"
fi

# 5. Генерация .env файла
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
SPRING_PROFILES_ACTIVE=prod
DOMAIN=$DOMAIN
EOF

# 6. Запуск
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

# Слайд 18: Переменные окружения

## Конфигурация развертывания

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DOMAIN` | `localhost` | Домен приложения |
| `APP_ROOT` | `/opt/book-read` | Директория установки |
| `VITE_API_URL` | `/api/v1` | Базовый URL API |
| `POSTGRES_DB` | `library` | Имя БД |
| `POSTGRES_USER` | `library` | Пользователь БД |
| `POSTGRES_PASSWORD` | *генерируется* | Пароль БД |
| `SPRING_PROFILES_ACTIVE` | `prod` | Профиль Spring |
| `USE_LETSENCRYPT` | `false` | Let's Encrypt |
| `LETSENCRYPT_EMAIL` | - | Email для сертификата |
| `JWT_SECRET` | *в application.yml* | Секрет JWT |
| `JWT_EXPIRATION` | `86400000` (24ч) | Время жизни токена |

## Конфигурация в application.yml

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/library}
  jpa:
    hibernate:
      ddl-auto: none  # Flyway управляет схемой

node:
  heartbeat-interval: ${NODE_HEARTBEAT_INTERVAL:10000}

logging:
  file:
    path: logs/
  level:
    com.library.tracker: DEBUG
```

---

# Слайд 19: Интересные технические решения

## 1. Оптимизация производительности

```sql
-- Индексы для быстрого поиска
CREATE INDEX idx_library_items_title ON library_items(LOWER(title));
CREATE INDEX idx_library_items_updated ON library_items(updated_at DESC);
CREATE INDEX idx_users_username ON users(LOWER(username));
```

## 2. Кеширование сессий

```java
// Guava Cache: 10K сессий, 2 дня TTL
Cache<UUID, Session> cache = CacheBuilder.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(2, TimeUnit.DAYS)
    .build();
```

## 3. Lazy loading отключен

```yaml
spring:
  jpa:
    open-in-view: false  # Предотвращает LazyInitializationException
```

## 4. Axios Interceptor для JWT

```typescript
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 5. Транзакционный экспорт

```java
@Transactional(readOnly = true)
public ExportData exportAll() {
    // Консистентный снапшот всех данных
}
```

---

# Слайд 20: Итоги и преимущества

## Ключевые преимущества системы

| Категория | Реализация |
|-----------|------------|
| **Безопасность** | JWT + Sessions, RBAC 4 уровня, bcrypt |
| **Масштабируемость** | Docker, кеширование, индексы БД |
| **Отказоустойчивость** | Health checks, экспорт/восстановление |
| **Мониторинг** | Real-time метрики, логи, мониторинг нод |
| **UX** | Расширенная фильтрация, аналитика |
| **DevOps** | Автоматизированный деплой, Let's Encrypt |

## Статистика кодовой базы

- **Backend**: ~15 сервисов, ~10 контроллеров
- **Frontend**: ~10 страниц, FSD архитектура
- **Database**: 7 миграций, 6 таблиц
- **Docker**: Multi-stage builds, health checks

## Готово к использованию!

```bash
# Быстрый старт
git clone <repo>
cd book-read
sudo ./deploy/install_on_ubuntu_22.sh
```

---

# Дополнительный слайд: API примеры

## Примеры запросов

### Регистрация пользователя
```bash
curl -X POST https://domain/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "reader", "password": "secret123"}'
```

### Создание книги
```bash
curl -X POST https://domain/api/v1/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Война и мир",
    "altTitle": "War and Peace",
    "typeId": "uuid-here",
    "status": "READING",
    "rating": 9.5,
    "favorite": true
  }'
```

### Получение аналитики
```bash
curl https://domain/api/v1/analytics/books \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "totalItems": 150,
  "favoriteItems": 25,
  "averageRating": 7.8,
  "statusBreakdown": {
    "READING": 10,
    "COMPLETED": 100,
    "PLANNED": 30,
    "DROPPED": 10
  },
  "topTypes": [...],
  "topSources": [...]
}
```
