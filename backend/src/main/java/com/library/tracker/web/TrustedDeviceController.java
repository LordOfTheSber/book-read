package com.library.tracker.web;

import com.library.tracker.domain.TrustedDevice;
import com.library.tracker.domain.User;
import com.library.tracker.security.DeviceTokenCookieService;
import com.library.tracker.service.TrustedDeviceService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.TrustedDeviceResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Свои доверенные устройства: посмотреть и отключить.
 * <p>
 * Живёт под {@code /api/v1/account}, потому что это те же «мои данные», что выгрузка и удаление
 * аккаунта, — вопрос не администрирования, а собственного доступа. Кука устройства сюда не
 * доходит (её путь уже), поэтому «это устройство» определяется по отпечатку из запроса.
 */
@RestController
@RequestMapping( "/api/v1/account/devices" )
@RequiredArgsConstructor
public class TrustedDeviceController {

    private final TrustedDeviceService trustedDeviceService;
    private final UserService userService;
    private final DeviceTokenCookieService deviceTokenCookieService;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @GetMapping
    public List<TrustedDeviceResponse> list( @RequestParam( required = false ) String fingerprint ) {
        User user = userService.getCurrentUser();
        return trustedDeviceService.listForUser( user )
                                   .stream()
                                   .map( device -> toResponse( device, fingerprint ) )
                                   .toList();
    }

    /**
     * Отключает устройство. Если отключают то, с которого пришёл запрос, ответ заодно гасит его
     * куку: иначе браузер продолжал бы предлагать быстрый вход по секрету, которого уже нет.
     */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{id}" )
    public ResponseEntity<Void> revoke( @PathVariable UUID id,
                                        @RequestParam( required = false ) String fingerprint ) {
        User user = userService.getCurrentUser();
        Optional<TrustedDevice> device = trustedDeviceService.findOwned( user, id );
        if ( device.isEmpty() ) {
            return ResponseEntity.notFound().build();
        }
        boolean current = trustedDeviceService.matchesFingerprint( device.get(), fingerprint );
        trustedDeviceService.revoke( user, id );
        return noContent( current );
    }

    /** «Выйти со всех устройств»: паролю снова придётся звучать везде, включая это устройство. */
    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping
    public ResponseEntity<Void> revokeAll() {
        trustedDeviceService.revokeAll( userService.getCurrentUser() );
        return noContent( true );
    }

    private ResponseEntity<Void> noContent( boolean clearCookie ) {
        ResponseEntity.HeadersBuilder<?> builder = ResponseEntity.noContent();
        if ( clearCookie ) {
            builder.header( HttpHeaders.SET_COOKIE, deviceTokenCookieService.buildExpired().toString() );
        }
        return builder.build();
    }

    private TrustedDeviceResponse toResponse( TrustedDevice device, String fingerprint ) {
        return TrustedDeviceResponse.builder()
                                    .id( device.getId() )
                                    .label( device.getLabel() )
                                    .lastIp( device.getLastIp() )
                                    .lastUsedAt( device.getLastUsedAt() )
                                    .expiresAt( device.getExpiresAt() )
                                    .current( trustedDeviceService.matchesFingerprint( device, fingerprint ) )
                                    .build();
    }
}
