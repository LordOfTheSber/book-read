package com.library.tracker.config;

import com.library.tracker.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain( HttpSecurity http ) throws Exception {
        http.csrf( csrf -> csrf.disable() )
            .authorizeHttpRequests( auth -> auth
                                                    .requestMatchers( "/api/v1/auth/**" ).permitAll()
                                                    .requestMatchers( "/swagger-ui/**", "/swagger-ui.html", "/v3/api" +
                                                                                                            "-docs" +
                                                                                                            "/**" ).permitAll()
                                                    .requestMatchers( "/api/v1/users/me" ).hasAnyRole( "SUPER_ADMIN",
                                                                                                       "ADMIN",
                                                                                                       "EDITOR",
                                                                                                       "USER" )
                                                    .requestMatchers( HttpMethod.PUT, "/api/v1/users/me/avatar" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/users/*/avatar" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/analytics/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( "/api/v1/users/**" ).hasAnyRole( "SUPER_ADMIN",
                                                                                                       "ADMIN" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/monitoring/ping" ).permitAll()
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/items/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.POST, "/api/v1/items" ).hasAnyRole(
                                                    "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.PUT, "/api/v1/items/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.DELETE, "/api/v1/items/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/book-types/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.POST, "/api/v1/book-types" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR" )
                                                    .requestMatchers( HttpMethod.PUT, "/api/v1/book-types/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR" )
                                                    .requestMatchers( HttpMethod.DELETE, "/api/v1/book-types/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/sources/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR", "USER" )
                                                    .requestMatchers( HttpMethod.GET, "/api/v1/nodes/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN" )
                                                    .requestMatchers( HttpMethod.POST, "/api/v1/sources" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR" )
                                                    .requestMatchers( HttpMethod.PUT, "/api/v1/sources/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN", "EDITOR" )
                                                    .requestMatchers( HttpMethod.DELETE, "/api/v1/sources/**" ).hasAnyRole( "SUPER_ADMIN", "ADMIN" )
                                                    .requestMatchers( "/api/v1/exports/**" ).hasRole( "SUPER_ADMIN" )
                                                    .requestMatchers( "/api/v1/sessions/**" ).hasAnyRole(
                                                    "SUPER_ADMIN", "ADMIN" )
                                                    .anyRequest().authenticated()
                                  )
            // Без явной точки входа Spring Security отвечает 403 и на неаутентифицированный запрос;
            // клиенту нужен 401, чтобы отличить истёкший токен от нехватки прав и обновить его.
            .exceptionHandling( handling -> handling.authenticationEntryPoint(
                    new HttpStatusEntryPoint( HttpStatus.UNAUTHORIZED ) ) )
            .sessionManagement( session -> session.sessionCreationPolicy( SessionCreationPolicy.STATELESS ) )
            .addFilterBefore( jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class );
        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager( AuthenticationConfiguration configuration ) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
