package com.library.tracker.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Actuator появился ради метрик, которые складываются по репликам. Проверяем, что метрики
 * действительно отдаются и что доступ к ним закрыт: /actuator/prometheus перечисляет пути и
 * тайминги приложения и посторонним виден быть не должен.
 */
@SpringBootTest
@AutoConfigureMockMvc
// Spring Boot глушит экспорт метрик в тестах — здесь он и есть предмет проверки.
@AutoConfigureObservability
class ActuatorEndpointsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    /** Пробы оркестратора ходят без учётных данных. */
    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform( get( "/actuator/health" ) ).andExpect( status().isOk() );
    }

    @Test
    void prometheusRejectsAnonymous() throws Exception {
        mockMvc.perform( get( "/actuator/prometheus" ) ).andExpect( status().isUnauthorized() );
    }

    @Test
    @WithMockUser( roles = "USER" )
    void prometheusRejectsRegularUser() throws Exception {
        mockMvc.perform( get( "/actuator/prometheus" ) ).andExpect( status().isForbidden() );
    }

    @Test
    @WithMockUser( roles = "ADMIN" )
    void prometheusExposesMetricsTaggedWithNode() throws Exception {
        mockMvc.perform( get( "/actuator/prometheus" ) )
               .andExpect( status().isOk() )
               .andExpect( content().string( org.hamcrest.Matchers.containsString( "application=\"book-read-backend\"" ) ) )
               .andExpect( content().string( org.hamcrest.Matchers.containsString( "node=" ) ) );
    }
}
