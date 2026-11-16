package com.library.tracker.service;

import com.library.tracker.domain.TrustedDevice;
import com.library.tracker.domain.User;
import com.library.tracker.repository.TrustedDeviceRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Быстрый вход по устройству: пользователь один раз подтверждает пароль, и с этого устройства
 * его узнают без него.
 * <p>
 * Устройство опознаётся двумя вещами сразу. Первая — секрет в httpOnly-куке
 * {@code DEVICE_TOKEN}: только он даёт вход, и в базе от него лежит один хеш. Вторая — отпечаток,
 * который считает браузер по неизменяемым свойствам машины (платформа, число ядер, память, часовой
 * пояс) и по метке, положенной в {@code localStorage}. Отпечаток не секрет и подделывается, но
 * подделать его нужно вместе с кукой, а кука недоступна из JavaScript — вдвоём они означают, что
 * запрос пришёл с того же устройства, где вход подтверждали паролем.
 * <p>
 * Секрет обновляется при каждом входе. Копия куки, снятая когда-то раньше, перестаёт работать,
 * как только настоящее устройство войдёт снова, — иначе один-единственный перехват давал бы доступ
 * на все оставшиеся месяцы жизни записи.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TrustedDeviceService {

    /** 256 бит случайности: перебором такой секрет не берётся, поэтому счётчика попыток нет. */
    private static final int TOKEN_BYTES = 32;

    /** Отпечаток приходит от клиента шестнадцатеричным SHA-256; всё длиннее — мусор или атака. */
    private static final int MAX_FINGERPRINT_LENGTH = 128;

    private final TrustedDeviceRepository trustedDeviceRepository;
    private final Clock clock;

    private final SecureRandom random = new SecureRandom();

    @Value( "${security.device.ttl-days:90}" )
    private int ttlDays;

    /**
     * Потолок на число устройств: без него список растёт молча — каждый чужой браузер, каждая
     * переустановка системы добавляют строку, и «забыть всё» становится единственным способом
     * навести порядок.
     */
    @Value( "${security.device.max-per-user:10}" )
    private int maxDevicesPerUser;

    /** Выданное устройство вместе с секретом: в открытом виде секрет существует только здесь. */
    public record IssuedDevice( TrustedDevice device, String token ) {
    }

    public Duration ttl() {
        return Duration.ofDays( ttlDays );
    }

    /**
     * Запоминает устройство после входа по паролю. Повторный вход с того же устройства обновляет
     * существующую запись: пара «пользователь + отпечаток» уникальна.
     */
    public Optional<IssuedDevice> remember( User user, String fingerprint, String userAgent, String ip,
                                            String requestedLabel ) {
        String fingerprintHash = hashFingerprint( fingerprint );
        if ( fingerprintHash == null ) {
            return Optional.empty();
        }

        TrustedDevice device = trustedDeviceRepository
                .findByUserIdAndFingerprintHash( user.getId(), fingerprintHash )
                .orElseGet( TrustedDevice::new );
        device.setUser( user );
        device.setFingerprintHash( fingerprintHash );
        device.setLabel( label( requestedLabel, userAgent ) );

        String token = issue( device, ip );
        if ( device.getId() == null ) {
            enforceDeviceLimit( user );
        }
        return Optional.of( new IssuedDevice( trustedDeviceRepository.save( device ), token ) );
    }

    /**
     * Кто стоит за кукой — без входа и без изменения записи. Нужно экрану входа, чтобы предложить
     * «продолжить как @user» вместо формы.
     */
    @Transactional( readOnly = true )
    public Optional<TrustedDevice> peek( String token, String fingerprint ) {
        return lookup( token, fingerprint );
    }

    /**
     * Вход по устройству. Секрет заменяется на новый, поэтому вызывающий обязан поставить куку
     * из ответа: со старым значением следующий вход уже не пройдёт.
     */
    public Optional<IssuedDevice> authenticate( String token, String fingerprint, String userAgent, String ip ) {
        Optional<TrustedDevice> found = lookup( token, fingerprint );
        if ( found.isEmpty() ) {
            return Optional.empty();
        }

        TrustedDevice device = found.get();
        if ( device.getUser().isBlocked() ) {
            trustedDeviceRepository.delete( device );
            return Optional.empty();
        }

        device.setLabel( label( null, userAgent ) );
        String rotated = issue( device, ip );
        return Optional.of( new IssuedDevice( trustedDeviceRepository.save( device ), rotated ) );
    }

    /** «Это не я» на экране входа: запись удаляется, вызывающий гасит куку. */
    public void forget( String token ) {
        hashToken( token ).flatMap( trustedDeviceRepository::findByTokenHash )
                          .ifPresent( trustedDeviceRepository::delete );
    }

    @Transactional( readOnly = true )
    public List<TrustedDevice> listForUser( User user ) {
        return trustedDeviceRepository.findByUserIdOrderByLastUsedAtDesc( user.getId() );
    }

    /**
     * Устройство из списка спрашивающего. Идентификатор чужой записи ничего не даёт: чужое
     * устройство не находится, а не «находится, но не удаляется».
     */
    @Transactional( readOnly = true )
    public Optional<TrustedDevice> findOwned( User user, UUID deviceId ) {
        return trustedDeviceRepository.findById( deviceId )
                                      .filter( device -> device.getUser().getId().equals( user.getId() ) );
    }

    public boolean revoke( User user, UUID deviceId ) {
        return findOwned( user, deviceId ).map( device -> {
            trustedDeviceRepository.delete( device );
            return true;
        } ).orElse( false );
    }

    public void revokeAll( User user ) {
        trustedDeviceRepository.deleteAllByUserId( user.getId() );
    }

    /** Совпадает ли устройство с тем, с которого пришёл запрос: список помечает его «это устройство». */
    public boolean matchesFingerprint( TrustedDevice device, String fingerprint ) {
        String fingerprintHash = hashFingerprint( fingerprint );
        return fingerprintHash != null && fingerprintHash.equals( device.getFingerprintHash() );
    }

    public void deleteExpired() {
        trustedDeviceRepository.deleteExpired( now() );
    }

    /**
     * Общая часть быстрого входа и подсказки: найти живую запись по секрету и убедиться, что
     * кукой пользуются с того же устройства.
     * <p>
     * Несовпадение отпечатка запись не удаляет. Отпечаток меняется и сам по себе — сменили
     * монитор, обновили систему, почистили {@code localStorage}, — и удалять по нему значило бы
     * наказывать за обновление браузера. Достаточно того, что вход не состоится и человек введёт
     * пароль.
     */
    private Optional<TrustedDevice> lookup( String token, String fingerprint ) {
        Optional<String> tokenHash = hashToken( token );
        String fingerprintHash = hashFingerprint( fingerprint );
        if ( tokenHash.isEmpty() || fingerprintHash == null ) {
            return Optional.empty();
        }

        Optional<TrustedDevice> found = trustedDeviceRepository.findByTokenHash( tokenHash.get() );
        if ( found.isEmpty() ) {
            return Optional.empty();
        }

        TrustedDevice device = found.get();
        if ( now().isAfter( device.getExpiresAt() ) ) {
            trustedDeviceRepository.delete( device );
            return Optional.empty();
        }
        if ( !fingerprintHash.equals( device.getFingerprintHash() ) ) {
            log.warn( "Кука устройства {} предъявлена с другим отпечатком — быстрый вход отклонён", device.getId() );
            return Optional.empty();
        }
        return Optional.of( device );
    }

    /** Выдаёт новый секрет и сдвигает срок жизни записи. Возвращает секрет в открытом виде. */
    private String issue( TrustedDevice device, String ip ) {
        byte[] secret = new byte[TOKEN_BYTES];
        random.nextBytes( secret );
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString( secret );

        OffsetDateTime now = now();
        device.setTokenHash( sha256( token ) );
        device.setLastUsedAt( now );
        device.setExpiresAt( now.plusDays( ttlDays ) );
        if ( StringUtils.hasText( ip ) ) {
            device.setLastIp( ip.length() > 45 ? ip.substring( 0, 45 ) : ip );
        }
        return token;
    }

    private void enforceDeviceLimit( User user ) {
        List<TrustedDevice> devices = trustedDeviceRepository.findByUserIdOrderByLastUsedAtDesc( user.getId() );
        if ( devices.size() < maxDevicesPerUser ) {
            return;
        }
        // Место под новую запись освобождают самые давние по последнему входу.
        devices.subList( maxDevicesPerUser - 1, devices.size() ).forEach( trustedDeviceRepository::delete );
    }

    private String label( String requestedLabel, String userAgent ) {
        String sanitized = DeviceLabel.sanitize( requestedLabel );
        return sanitized != null ? sanitized : DeviceLabel.fromUserAgent( userAgent );
    }

    private Optional<String> hashToken( String token ) {
        return StringUtils.hasText( token ) ? Optional.of( sha256( token ) ) : Optional.empty();
    }

    private String hashFingerprint( String fingerprint ) {
        if ( !StringUtils.hasText( fingerprint ) || fingerprint.length() > MAX_FINGERPRINT_LENGTH ) {
            return null;
        }
        return sha256( fingerprint.strip() );
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now( clock ).withOffsetSameInstant( ZoneOffset.UTC );
    }

    private static String sha256( String value ) {
        try {
            MessageDigest digest = MessageDigest.getInstance( "SHA-256" );
            return HexFormat.of().formatHex( digest.digest( value.getBytes( StandardCharsets.UTF_8 ) ) );
        } catch ( NoSuchAlgorithmException ex ) {
            throw new IllegalStateException( "SHA-256 недоступен", ex );
        }
    }
}
