package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

/**
 * Быстрый вход по устройству. Секрет в теле не передаётся — он приходит httpOnly-кукой
 * {@code DEVICE_TOKEN}; здесь только отпечаток, который браузер считает по свойствам машины.
 */
@Data
public class DeviceLoginRequest {

    @NotBlank
    @Size( max = 128 )
    private String fingerprint;
}
