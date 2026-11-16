# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
# Локальный репозиторий Maven живёт в кэше сборщика: зависимости не качаются заново при каждой
# пересборке образа, то есть при каждом запуске установщика.
RUN --mount=type=cache,target=/root/.m2 mvn -B -DskipTests package

# Fat jar раскладывается на слои: библиотеки отдельно от кода приложения. Слой с библиотеками
# меняется редко, поэтому после правки кода пересобирается и перекачивается только тонкий верхний.
FROM eclipse-temurin:25-jre AS extract
WORKDIR /build
COPY --from=build /app/target/library-tracker-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --destination extracted

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=extract /build/extracted/dependencies/ ./
COPY --from=extract /build/extracted/spring-boot-loader/ ./
COPY --from=extract /build/extracted/snapshot-dependencies/ ./
COPY --from=extract /build/extracted/application/ ./

# AOT-кэш (JEP 483/514): пробный запуск записывает уже загруженные и слинкованные классы, и боевой
# старт берёт их готовыми — приложение поднимается примерно вдвое быстрее. База на сборке
# недоступна, поэтому контекст собирается без обращений к ней и завершается сразу после сборки.
# Флаги JVM и путь к jar здесь и в ENTRYPOINT обязаны совпадать, иначе кэш молча не применится.
RUN java -XX:+UseCompactObjectHeaders -XX:AOTCacheOutput=/app/app.aot \
        -Dspring.context.exit=onRefresh \
        -Dspring.flyway.enabled=false \
        -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect \
        -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
        -Dspring.datasource.hikari.connection-timeout=250 \
        -Dspring.datasource.hikari.initialization-fail-timeout=-1 \
        -jar app.jar \
    && rm -rf logs storage exports

EXPOSE 8080
# UseCompactObjectHeaders (JEP 519): заголовок объекта 8 байт вместо 12 — куча меньше на 10–20 %.
ENTRYPOINT ["java", "-XX:AOTCache=/app/app.aot", "-XX:+UseCompactObjectHeaders", "-jar", "/app/app.jar"]
