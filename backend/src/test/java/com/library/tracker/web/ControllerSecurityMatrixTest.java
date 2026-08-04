package com.library.tracker.web;

import com.library.tracker.config.SecurityConfig;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.JwtAuthenticationFilter;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.BookTypeService;
import com.library.tracker.service.DataExportService;
import com.library.tracker.service.LibraryItemService;
import com.library.tracker.service.MonitoringMetricsSnapshotService;
import com.library.tracker.service.MonitoringSettingsService;
import com.library.tracker.service.NodeService;
import com.library.tracker.service.RequestMetricsService;
import com.library.tracker.service.SessionService;
import com.library.tracker.service.SourceService;
import com.library.tracker.service.UserService;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Матрица «эндпоинт × роль». Права разложены по двум местам — правилам URL в
 * {@link SecurityConfig} и аннотациям {@code @PreAuthorize} на методах, — и по каждому отдельному
 * файлу не видно, что получается в сумме. Здесь проверяется именно сумма: для каждой пары
 * запрашивается ответ и сверяется, пустили или нет.
 * <p>
 * «Пустили» — это «ответ не 401 и не 403»: сервисы замоканы, поэтому конкретный код успеха
 * не о чём не говорит, а вот отказ говорит.
 */
@WebMvcTest( controllers = {
        LibraryItemController.class,
        BookTypeController.class,
        SourceController.class,
        UserController.class,
        AnalyticsController.class,
        NodeController.class,
        MonitoringController.class,
        SessionSettingsController.class,
        ExportController.class
} )
@Import( { SecurityConfig.class, ControllerSecurityMatrixTest.FilterConfiguration.class } )
class ControllerSecurityMatrixTest {

    private static final String SUPER_ADMIN = "SUPER_ADMIN";
    private static final String ADMIN = "ADMIN";
    private static final String EDITOR = "EDITOR";
    private static final String USER = "USER";

    private static final List<String> ALL_ROLES = List.of( SUPER_ADMIN, ADMIN, EDITOR, USER );

    private static final UUID ID = UUID.fromString( "11111111-1111-1111-1111-111111111111" );

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LibraryItemService libraryItemService;

    @MockBean
    private BookTypeService bookTypeService;

    @MockBean
    private SourceService sourceService;

    @MockBean
    private UserService userService;

    @MockBean
    private NodeService nodeService;

    @MockBean
    private MonitoringMetricsSnapshotService monitoringMetricsSnapshotService;

    @MockBean
    private MonitoringSettingsService monitoringSettingsService;

    @MockBean
    private SessionService sessionService;

    @MockBean
    private DataExportService dataExportService;

    @MockBean
    private JwtService jwtService;

    /** Нужен фильтру логирования, который {@code @WebMvcTest} поднимает вместе с MVC. */
    @MockBean
    private RequestMetricsService requestMetricsService;

    /**
     * {@link SecurityConfig} требует фильтр как зависимость, а {@code @WebMvcTest} обычные
     * {@code @Component} не поднимает. Мок здесь не годится: он не продолжил бы цепочку фильтров.
     * Настоящий фильтр без куки и заголовка просто пропускает запрос дальше — ровно то, что нужно,
     * потому что аутентификацию в этом тесте задаёт Spring Security Test.
     */
    @TestConfiguration
    static class FilterConfiguration {

        @Bean
        JwtAuthenticationFilter jwtAuthenticationFilter( JwtService jwtService, UserService userService,
                                                         SessionService sessionService ) {
            return new JwtAuthenticationFilter( jwtService, userService, sessionService,
                                                new AccessTokenCookieService() );
        }
    }

    @ParameterizedTest( name = "{0} {1} — {2}" )
    @MethodSource( "roleMatrix" )
    void endpointAllowsOnlyItsRoles( HttpMethod method, String path, String role, String body, boolean allowed )
            throws Exception {
        MvcResult result = mockMvc.perform( withBody( request( method, path ).with( user( "tester" ).roles( role ) ),
                                                      body ) )
                                  .andReturn();

        if ( allowed ) {
            assertThat( result.getResponse().getStatus() )
                    .as( "%s %s должен быть доступен роли %s", method, path, role )
                    .isNotIn( 401, 403 );
        } else {
            assertThat( result.getResponse().getStatus() )
                    .as( "%s %s не должен быть доступен роли %s", method, path, role )
                    .isEqualTo( 403 );
        }
    }

    @ParameterizedTest( name = "{0} {1}" )
    @MethodSource( "protectedEndpoints" )
    @WithAnonymousUser
    void endpointRejectsAnonymousWithUnauthorized( HttpMethod method, String path, String body ) throws Exception {
        MvcResult result = mockMvc.perform( withBody( request( method, path ), body ) ).andReturn();

        assertThat( result.getResponse().getStatus() )
                .as( "%s %s должен требовать аутентификации", method, path )
                .isEqualTo( 401 );
    }

    /** Пинг мониторинга опрашивают снаружи, поэтому он единственный открыт анонимно. */
    @Test
    @WithAnonymousUser
    void monitoringPingIsOpenToAnonymous() throws Exception {
        MvcResult result = mockMvc.perform( request( HttpMethod.GET, "/api/v1/monitoring/ping" ) ).andReturn();

        assertThat( result.getResponse().getStatus() ).isEqualTo( 200 );
    }

    private static MockHttpServletRequestBuilder withBody( MockHttpServletRequestBuilder builder, String body ) {
        if ( body == null ) {
            return builder;
        }
        // Тело нужно даже там, где ждём отказ: @PreAuthorize срабатывает после разбора аргументов,
        // и без тела вместо 403 вернулось бы 400.
        return builder.contentType( MediaType.APPLICATION_JSON ).content( body );
    }

    private static Stream<Object[]> roleMatrix() {
        return endpoints().flatMap( endpoint -> ALL_ROLES.stream()
                                                         .map( role -> new Object[] {
                                                                 endpoint.method(),
                                                                 endpoint.path(),
                                                                 role,
                                                                 endpoint.body(),
                                                                 endpoint.allowedRoles().contains( role ) } ) );
    }

    private static Stream<Object[]> protectedEndpoints() {
        return endpoints().map( endpoint -> new Object[] { endpoint.method(), endpoint.path(), endpoint.body() } );
    }

    private static Stream<Endpoint> endpoints() {
        String itemBody = "{\"title\":\"Название\",\"status\":\"PLANNED\"}";
        String typeBody = "{\"name\":\"Роман\"}";
        String sourceBody = "{\"name\":\"Магазин\",\"url\":\"https://example.com\"}";

        return Stream.of(
                // Своя библиотека: доступна всем ролям, разграничение по владельцу живёт в сервисе.
                Endpoint.get( "/api/v1/items", SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.get( "/api/v1/items/" + ID, SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.post( "/api/v1/items", itemBody, SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.put( "/api/v1/items/" + ID, itemBody, SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.delete( "/api/v1/items/" + ID, SUPER_ADMIN, ADMIN, EDITOR, USER ),

                // Справочники: читают все, правят редакторы, удаляют администраторы.
                Endpoint.get( "/api/v1/types", SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.post( "/api/v1/types", typeBody, SUPER_ADMIN, ADMIN, EDITOR ),
                Endpoint.put( "/api/v1/types/" + ID, typeBody, SUPER_ADMIN, ADMIN, EDITOR ),
                Endpoint.delete( "/api/v1/types/" + ID, SUPER_ADMIN, ADMIN ),
                Endpoint.get( "/api/v1/sources", SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.post( "/api/v1/sources", sourceBody, SUPER_ADMIN, ADMIN, EDITOR ),
                Endpoint.put( "/api/v1/sources/" + ID, sourceBody, SUPER_ADMIN, ADMIN, EDITOR ),
                Endpoint.delete( "/api/v1/sources/" + ID, SUPER_ADMIN, ADMIN ),

                // Пользователи: свой профиль виден всем, чужие карточки — администраторам,
                // роль и блокировка — только супер-администратору.
                Endpoint.get( "/api/v1/users/me", SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.get( "/api/v1/users/" + ID + "/avatar", SUPER_ADMIN, ADMIN, EDITOR, USER ),
                Endpoint.get( "/api/v1/users", SUPER_ADMIN, ADMIN ),
                Endpoint.put( "/api/v1/users/" + ID + "/session-settings",
                              "{\"sessionTtlMinutes\":30,\"maxSessionLifetimeMinutes\":120}", SUPER_ADMIN, ADMIN ),
                Endpoint.delete( "/api/v1/users/" + ID + "/session-settings", SUPER_ADMIN, ADMIN ),
                Endpoint.put( "/api/v1/users/" + ID + "/role", "{\"role\":\"USER\"}", SUPER_ADMIN ),
                Endpoint.put( "/api/v1/users/" + ID + "/block", "{\"blocked\":true}", SUPER_ADMIN ),

                Endpoint.get( "/api/v1/analytics/books", SUPER_ADMIN, ADMIN, EDITOR, USER ),

                // Эксплуатация: узлы и мониторинг администраторам, логи и настройки — супер-администратору.
                Endpoint.get( "/api/v1/nodes", SUPER_ADMIN, ADMIN ),
                Endpoint.get( "/api/v1/nodes/" + ID, SUPER_ADMIN, ADMIN ),
                Endpoint.get( "/api/v1/nodes/" + ID + "/memory", SUPER_ADMIN, ADMIN ),
                Endpoint.get( "/api/v1/nodes/" + ID + "/logs", SUPER_ADMIN ),
                Endpoint.get( "/api/v1/monitoring/metrics", SUPER_ADMIN, ADMIN ),
                Endpoint.put( "/api/v1/monitoring/metrics", "{\"enabled\":true}", SUPER_ADMIN, ADMIN ),
                Endpoint.get( "/api/v1/monitoring/settings", SUPER_ADMIN ),
                Endpoint.put( "/api/v1/monitoring/settings",
                              "{\"pingIntervalSeconds\":30,\"pingPath\":\"/api/v1/monitoring/ping\"}", SUPER_ADMIN ),
                Endpoint.get( "/api/v1/sessions/settings", SUPER_ADMIN, ADMIN ),
                Endpoint.put( "/api/v1/sessions/settings",
                              "{\"sessionTtlMinutes\":30,\"maxSessionLifetimeMinutes\":120}", SUPER_ADMIN, ADMIN ),

                // Выгрузка базы целиком — только супер-администратору.
                Endpoint.get( "/api/v1/exports", SUPER_ADMIN ),
                Endpoint.post( "/api/v1/exports", null, SUPER_ADMIN ),
                Endpoint.get( "/api/v1/exports/backup.zip", SUPER_ADMIN ),
                Endpoint.post( "/api/v1/exports/backup.zip/restore", null, SUPER_ADMIN ),
                Endpoint.delete( "/api/v1/exports/backup.zip", SUPER_ADMIN )
        );
    }

    private record Endpoint( HttpMethod method, String path, String body, Set<String> allowedRoles ) {

        private static Endpoint get( String path, String... roles ) {
            return new Endpoint( HttpMethod.GET, path, null, Set.of( roles ) );
        }

        private static Endpoint post( String path, String body, String... roles ) {
            return new Endpoint( HttpMethod.POST, path, body, Set.of( roles ) );
        }

        private static Endpoint put( String path, String body, String... roles ) {
            return new Endpoint( HttpMethod.PUT, path, body, Set.of( roles ) );
        }

        private static Endpoint delete( String path, String... roles ) {
            return new Endpoint( HttpMethod.DELETE, path, null, Set.of( roles ) );
        }
    }
}
