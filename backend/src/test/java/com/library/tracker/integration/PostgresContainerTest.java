package com.library.tracker.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * База для тестов, которым нужна настоящая БД. Раньше они шли на H2 в режиме совместимости, из-за
 * чего миграции Flyway фактически не проверялись: схему создавал Hibernate, а продакшен работает
 * на PostgreSQL. Здесь поднимается PostgreSQL той же версии, что в проде, и схему на нём строит
 * Flyway — то есть каждая миграция прогоняется на каждом запуске тестов.
 * <p>
 * Контейнер один на весь прогон: он не привязан к жизненному циклу класса, а останавливается вместе
 * с JVM (за уборкой следит Ryuk). Без доступного Docker наследники не запускаются, а помечаются
 * пропущенными — CI проверяет наличие Docker отдельным шагом, чтобы пропуск не остался незамеченным.
 */
@Testcontainers( disabledWithoutDocker = true )
public abstract class PostgresContainerTest {

    private static final PostgreSQLContainer<?> POSTGRES = startIfDockerAvailable();

    private static PostgreSQLContainer<?> startIfDockerAvailable() {
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>( "postgres:16-alpine" );
        if ( DockerClientFactory.instance().isDockerAvailable() ) {
            container.start();
        }
        return container;
    }

    @DynamicPropertySource
    static void datasourceProperties( DynamicPropertyRegistry registry ) {
        registry.add( "spring.datasource.url", POSTGRES::getJdbcUrl );
        registry.add( "spring.datasource.username", POSTGRES::getUsername );
        registry.add( "spring.datasource.password", POSTGRES::getPassword );
        registry.add( "spring.datasource.driver-class-name", POSTGRES::getDriverClassName );
        // Схему создаёт Flyway — иначе проверять миграции было бы нечем.
        registry.add( "spring.flyway.enabled", () -> true );
        registry.add( "spring.jpa.hibernate.ddl-auto", () -> "none" );
    }
}
