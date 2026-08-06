package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;

import lombok.Data;

/**
 * Обложка из внешнего каталога. Файл забирает сервер, а не браузер: у каталогов нет CORS-заголовков,
 * а хранилище всё равно наше. Список разрешённых хостов проверяется на сервере — иначе поле
 * превратилось бы в готовый SSRF.
 */
@Data
public class CoverFromUrlRequest {

    @NotBlank( message = "Cover url is required" )
    private String url;
}
