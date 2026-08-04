package com.library.tracker.web;

import com.library.tracker.config.SecurityConfig;
import com.library.tracker.security.AccessTokenCookieService;
import com.library.tracker.security.JwtAuthenticationFilter;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.LibraryItemService;
import com.library.tracker.service.RequestMetricsService;
import com.library.tracker.service.SessionService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.LibraryItemRequest;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Разграничение по владельцу живёт в {@code LibraryItemService} (см. P0-1 в ROADMAP), а по HTTP
 * оно видно только через код ответа. Здесь проверяется, что отказ сервиса доезжает до клиента как
 * 403, а не как 500 и не как чужие данные: роль {@code USER} проходит проверку по URL у всех этих
 * методов, поэтому единственная защита чужой записи — именно это преобразование.
 */
@WebMvcTest( controllers = LibraryItemController.class )
@Import( { SecurityConfig.class, LibraryItemControllerTest.FilterConfiguration.class } )
class LibraryItemControllerTest {

    private static final UUID FOREIGN_ITEM = UUID.fromString( "22222222-2222-2222-2222-222222222222" );

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LibraryItemService libraryItemService;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private SessionService sessionService;

    @MockBean
    private RequestMetricsService requestMetricsService;

    @TestConfiguration
    static class FilterConfiguration {

        @Bean
        JwtAuthenticationFilter jwtAuthenticationFilter( JwtService jwtService, UserService userService,
                                                         SessionService sessionService ) {
            return new JwtAuthenticationFilter( jwtService, userService, sessionService,
                                                new AccessTokenCookieService() );
        }
    }

    @Test
    @WithMockUser( roles = "USER" )
    void updateOfForeignItemReturnsForbidden() throws Exception {
        when( libraryItemService.update( eq( FOREIGN_ITEM ), any( LibraryItemRequest.class ) ) )
                .thenThrow( new AccessDeniedException( "Вы можете редактировать только свои книги" ) );

        mockMvc.perform( put( "/api/v1/items/" + FOREIGN_ITEM )
                                 .contentType( MediaType.APPLICATION_JSON )
                                 .content( "{\"title\":\"Перезаписано\",\"status\":\"PLANNED\"}" ) )
               .andExpect( status().isForbidden() );
    }

    @Test
    @WithMockUser( roles = "USER" )
    void deleteOfForeignItemReturnsForbidden() throws Exception {
        doThrow( new AccessDeniedException( "Вы можете удалять только свои книги" ) )
                .when( libraryItemService ).delete( eq( FOREIGN_ITEM ) );

        mockMvc.perform( delete( "/api/v1/items/" + FOREIGN_ITEM ) ).andExpect( status().isForbidden() );
    }

    /** Чужая запись для не-владельца не существует: сервис возвращает пусто, контроллер — 404. */
    @Test
    @WithMockUser( roles = "USER" )
    void getByIdOfForeignItemReturnsNotFound() throws Exception {
        when( libraryItemService.getById( eq( FOREIGN_ITEM ) ) ).thenReturn( Optional.empty() );

        mockMvc.perform( get( "/api/v1/items/" + FOREIGN_ITEM ) ).andExpect( status().isNotFound() );
    }

    @Test
    @WithMockUser( roles = "USER" )
    void listFilteredByForeignUserReturnsForbidden() throws Exception {
        when( libraryItemService.getItems( any() ) )
                .thenThrow( new AccessDeniedException( "Недостаточно прав для просмотра книг другого пользователя" ) );

        mockMvc.perform( get( "/api/v1/items" ).param( "userId", UUID.randomUUID().toString() ) )
               .andExpect( status().isForbidden() );
    }
}
