package com.library.tracker.service;

import java.util.Locale;

import org.springframework.util.StringUtils;

/**
 * Подпись устройства для списка «мои устройства».
 * <p>
 * Разбор User-Agent намеренно грубый: точная его классификация — отдельная библиотека с
 * ежемесячно стареющими таблицами, а здесь подпись нужна лишь для того, чтобы человек узнал
 * среди своих устройств то, которое хочет отключить. Ошибка в ней не влияет ни на доступ, ни на
 * сверку отпечатка: и то и другое считается по секрету и хешу, а не по этой строке.
 */
final class DeviceLabel {

    static final String UNKNOWN = "Неизвестное устройство";

    private static final int MAX_LENGTH = 128;

    private DeviceLabel() {
    }

    static String fromUserAgent( String userAgent ) {
        if ( !StringUtils.hasText( userAgent ) ) {
            return UNKNOWN;
        }
        String value = userAgent.toLowerCase( Locale.ROOT );
        String browser = browser( value );
        String platform = platform( value );
        if ( browser == null && platform == null ) {
            return UNKNOWN;
        }
        if ( browser == null ) {
            return platform;
        }
        return platform == null ? browser : browser + " · " + platform;
    }

    /** Явно заданное человеком имя устройства важнее разобранного из User-Agent. */
    static String sanitize( String requested ) {
        if ( !StringUtils.hasText( requested ) ) {
            return null;
        }
        String trimmed = requested.strip();
        return trimmed.length() > MAX_LENGTH ? trimmed.substring( 0, MAX_LENGTH ) : trimmed;
    }

    /**
     * Порядок проверок — не алфавитный: Edge и Opera представляются Chrome-ом, Chrome — Safari,
     * поэтому частные случаи идут раньше общих.
     */
    private static String browser( String userAgent ) {
        if ( userAgent.contains( "edg/" ) || userAgent.contains( "edga/" ) ) {
            return "Edge";
        }
        if ( userAgent.contains( "opr/" ) || userAgent.contains( "opera" ) ) {
            return "Opera";
        }
        if ( userAgent.contains( "yabrowser" ) ) {
            return "Яндекс.Браузер";
        }
        if ( userAgent.contains( "firefox" ) || userAgent.contains( "fxios" ) ) {
            return "Firefox";
        }
        if ( userAgent.contains( "chrome" ) || userAgent.contains( "crios" ) ) {
            return "Chrome";
        }
        if ( userAgent.contains( "safari" ) ) {
            return "Safari";
        }
        return null;
    }

    private static String platform( String userAgent ) {
        if ( userAgent.contains( "iphone" ) ) {
            return "iPhone";
        }
        if ( userAgent.contains( "ipad" ) ) {
            return "iPad";
        }
        if ( userAgent.contains( "android" ) ) {
            return "Android";
        }
        if ( userAgent.contains( "windows" ) ) {
            return "Windows";
        }
        if ( userAgent.contains( "mac os" ) || userAgent.contains( "macintosh" ) ) {
            return "macOS";
        }
        if ( userAgent.contains( "linux" ) ) {
            return "Linux";
        }
        return null;
    }
}
