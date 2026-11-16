package com.library.tracker.web.dto;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Имя признака публичности в JSON.
 * <p>
 * У boolean-поля {@code isPublic} Lombok делает геттер {@code isPublic()}, а Jackson выводит из
 * него свойство «public» — не то, которое читает и шлёт клиент. Полка молча создавалась приватной,
 * что бы ни стояло в переключателе формы, и признак «общая» не загорался никогда. Имя закреплено
 * тестом: ошибка снова стала бы невидимой — оба конца остались бы «рабочими» по отдельности.
 */
class ShelfJsonContractTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void responseNamesPublicFlagAsIsPublic() throws Exception {
        ShelfResponse response = ShelfResponse.builder().name( "Книжный клуб" ).isPublic( true ).build();

        String json = mapper.writeValueAsString( response );

        assertThat( json ).contains( "\"isPublic\":true" );
        // Второго имени быть не должно: одно и то же значение под двумя ключами — приглашение
        // прочитать не тот.
        assertThat( json ).doesNotContain( "\"public\"" );
    }

    @Test
    void requestReadsIsPublicFromClient() throws Exception {
        ShelfRequest request = mapper.readValue( "{\"name\":\"Книжный клуб\",\"isPublic\":true}", ShelfRequest.class );

        assertThat( request.isPublic() ).isTrue();
    }
}
