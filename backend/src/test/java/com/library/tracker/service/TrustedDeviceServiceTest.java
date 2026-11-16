package com.library.tracker.service;

import com.library.tracker.domain.TrustedDevice;
import com.library.tracker.domain.User;
import com.library.tracker.repository.TrustedDeviceRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class TrustedDeviceServiceTest {

    private static final String FINGERPRINT = "d7ac1f0e5b";

    @Mock
    private TrustedDeviceRepository trustedDeviceRepository;

    private TrustedDeviceService service;

    private final Clock clock = Clock.fixed( Instant.parse( "2026-03-01T10:00:00Z" ), ZoneOffset.UTC );

    @BeforeEach
    void setUp() {
        service = new TrustedDeviceService( trustedDeviceRepository, clock );
        ReflectionTestUtils.setField( service, "ttlDays", 90 );
        ReflectionTestUtils.setField( service, "maxDevicesPerUser", 3 );
    }

    /** Секрет существует один раз — в ответе. В базу уходит только хеш от него. */
    @Test
    void rememberKeepsSecretOutOfDatabase() {
        User user = user( false );
        when( trustedDeviceRepository.findByUserIdAndFingerprintHash( eq( user.getId() ), any() ) )
                .thenReturn( Optional.empty() );
        when( trustedDeviceRepository.findByUserIdOrderByLastUsedAtDesc( eq( user.getId() ) ) )
                .thenReturn( List.of() );
        echoSave();

        TrustedDeviceService.IssuedDevice issued =
                service.remember( user, FINGERPRINT, "Mozilla/5.0 (Windows NT 10.0) Chrome/120", "10.0.0.1", null )
                       .orElseThrow();

        assertThat( issued.token() ).isNotBlank();
        assertThat( issued.device().getTokenHash() ).isEqualTo( sha256( issued.token() ) )
                                                    .isNotEqualTo( issued.token() );
        assertThat( issued.device().getFingerprintHash() ).isEqualTo( sha256( FINGERPRINT ) );
        assertThat( issued.device().getLabel() ).isEqualTo( "Chrome · Windows" );
        assertThat( issued.device().getExpiresAt() ).isEqualTo( now().plusDays( 90 ) );
    }

    /** Без отпечатка запоминать нечего: одной куки для опознания устройства мало. */
    @Test
    void rememberRequiresFingerprint() {
        assertThat( service.remember( user( false ), " ", "agent", "10.0.0.1", null ) ).isEmpty();
        verify( trustedDeviceRepository, never() ).save( any() );
    }

    /** Повторный вход с того же устройства обновляет запись, а не заводит вторую. */
    @Test
    void rememberReusesRecordOfSameDevice() {
        User user = user( false );
        TrustedDevice existing = device( user, "old-secret", FINGERPRINT );
        when( trustedDeviceRepository.findByUserIdAndFingerprintHash( eq( user.getId() ), eq( sha256( FINGERPRINT ) ) ) )
                .thenReturn( Optional.of( existing ) );
        echoSave();

        TrustedDeviceService.IssuedDevice issued =
                service.remember( user, FINGERPRINT, "agent", "10.0.0.1", "Ноутбук" ).orElseThrow();

        assertThat( issued.device().getId() ).isEqualTo( existing.getId() );
        assertThat( issued.device().getLabel() ).isEqualTo( "Ноутбук" );
        verify( trustedDeviceRepository, never() ).findByUserIdOrderByLastUsedAtDesc( any() );
    }

    /** Место под новое устройство освобождают самые давние по последнему входу. */
    @Test
    void rememberEvictsOldestDeviceOverLimit() {
        User user = user( false );
        List<TrustedDevice> existing = new ArrayList<>();
        for ( int index = 0; index < 3; index++ ) {
            existing.add( device( user, "secret-" + index, "fingerprint-" + index ) );
        }
        when( trustedDeviceRepository.findByUserIdAndFingerprintHash( eq( user.getId() ), any() ) )
                .thenReturn( Optional.empty() );
        when( trustedDeviceRepository.findByUserIdOrderByLastUsedAtDesc( eq( user.getId() ) ) )
                .thenReturn( existing );
        echoSave();

        service.remember( user, FINGERPRINT, "agent", "10.0.0.1", null );

        verify( trustedDeviceRepository ).delete( eq( existing.get( 2 ) ) );
        verify( trustedDeviceRepository, never() ).delete( eq( existing.get( 0 ) ) );
    }

    /** Вход по устройству меняет секрет: снятая когда-то копия куки перестаёт работать. */
    @Test
    void authenticateRotatesSecret() {
        User user = user( false );
        TrustedDevice stored = device( user, "current-secret", FINGERPRINT );
        when( trustedDeviceRepository.findByTokenHash( eq( sha256( "current-secret" ) ) ) )
                .thenReturn( Optional.of( stored ) );
        echoSave();

        TrustedDeviceService.IssuedDevice issued =
                service.authenticate( "current-secret", FINGERPRINT, "agent", "10.0.0.1" ).orElseThrow();

        assertThat( issued.token() ).isNotEqualTo( "current-secret" );
        assertThat( issued.device().getTokenHash() ).isEqualTo( sha256( issued.token() ) );
        assertThat( issued.device().getLastUsedAt() ).isEqualTo( now() );
    }

    /**
     * Кука, предъявленная с чужого устройства, входа не даёт. Запись при этом остаётся: отпечаток
     * меняется и сам по себе — от смены монитора до очистки хранилища браузера.
     */
    @Test
    void authenticateRejectsForeignFingerprint() {
        User user = user( false );
        TrustedDevice stored = device( user, "current-secret", FINGERPRINT );
        when( trustedDeviceRepository.findByTokenHash( eq( sha256( "current-secret" ) ) ) )
                .thenReturn( Optional.of( stored ) );

        assertThat( service.authenticate( "current-secret", "другой-отпечаток", "agent", "10.0.0.1" ) ).isEmpty();
        verify( trustedDeviceRepository, never() ).delete( any() );
        verify( trustedDeviceRepository, never() ).save( any() );
    }

    @Test
    void authenticateDropsExpiredDevice() {
        User user = user( false );
        TrustedDevice stored = device( user, "current-secret", FINGERPRINT );
        stored.setExpiresAt( now().minusDays( 1 ) );
        when( trustedDeviceRepository.findByTokenHash( eq( sha256( "current-secret" ) ) ) )
                .thenReturn( Optional.of( stored ) );

        assertThat( service.authenticate( "current-secret", FINGERPRINT, "agent", "10.0.0.1" ) ).isEmpty();
        verify( trustedDeviceRepository ).delete( eq( stored ) );
    }

    /** Блокировка отменяет доверие: иначе заблокированный входил бы без пароля до первой проверки. */
    @Test
    void authenticateDropsDeviceOfBlockedUser() {
        User user = user( true );
        TrustedDevice stored = device( user, "current-secret", FINGERPRINT );
        when( trustedDeviceRepository.findByTokenHash( eq( sha256( "current-secret" ) ) ) )
                .thenReturn( Optional.of( stored ) );

        assertThat( service.authenticate( "current-secret", FINGERPRINT, "agent", "10.0.0.1" ) ).isEmpty();
        verify( trustedDeviceRepository ).delete( eq( stored ) );
    }

    @Test
    void authenticateIgnoresUnknownSecret() {
        when( trustedDeviceRepository.findByTokenHash( any() ) ).thenReturn( Optional.empty() );

        assertThat( service.authenticate( "чужой-секрет", FINGERPRINT, "agent", "10.0.0.1" ) ).isEmpty();
    }

    /** Чужое устройство не находится по идентификатору: перебор чужих UUID ничего не даёт. */
    @Test
    void revokeIgnoresDeviceOfAnotherUser() {
        User owner = user( false );
        User stranger = user( false );
        TrustedDevice stored = device( owner, "secret", FINGERPRINT );
        when( trustedDeviceRepository.findById( eq( stored.getId() ) ) ).thenReturn( Optional.of( stored ) );

        assertThat( service.revoke( stranger, stored.getId() ) ).isFalse();
        verify( trustedDeviceRepository, never() ).delete( any() );
    }

    @Test
    void revokeRemovesOwnDevice() {
        User owner = user( false );
        TrustedDevice stored = device( owner, "secret", FINGERPRINT );
        when( trustedDeviceRepository.findById( eq( stored.getId() ) ) ).thenReturn( Optional.of( stored ) );

        assertThat( service.revoke( owner, stored.getId() ) ).isTrue();
        verify( trustedDeviceRepository ).delete( eq( stored ) );
    }

    @Test
    void forgetRemovesDeviceBehindCookie() {
        User owner = user( false );
        TrustedDevice stored = device( owner, "secret", FINGERPRINT );
        when( trustedDeviceRepository.findByTokenHash( eq( sha256( "secret" ) ) ) ).thenReturn( Optional.of( stored ) );

        service.forget( "secret" );

        verify( trustedDeviceRepository ).delete( eq( stored ) );
    }

    @Test
    void matchesFingerprintTellsCurrentDeviceApart() {
        TrustedDevice stored = device( user( false ), "secret", FINGERPRINT );

        assertThat( service.matchesFingerprint( stored, FINGERPRINT ) ).isTrue();
        assertThat( service.matchesFingerprint( stored, "другой" ) ).isFalse();
        assertThat( service.matchesFingerprint( stored, null ) ).isFalse();
    }

    private void echoSave() {
        when( trustedDeviceRepository.save( any( TrustedDevice.class ) ) ).thenAnswer( invocation -> {
            TrustedDevice device = invocation.getArgument( 0 );
            if ( device.getId() == null ) {
                device.setId( UUID.randomUUID() );
            }
            return device;
        } );
    }

    private User user( boolean blocked ) {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "alex" );
        user.setBlocked( blocked );
        return user;
    }

    private TrustedDevice device( User user, String token, String fingerprint ) {
        TrustedDevice device = new TrustedDevice();
        device.setId( UUID.randomUUID() );
        device.setUser( user );
        device.setTokenHash( sha256( token ) );
        device.setFingerprintHash( sha256( fingerprint ) );
        device.setLabel( "Chrome · Windows" );
        device.setLastUsedAt( now().minusDays( 2 ) );
        device.setExpiresAt( now().plusDays( 30 ) );
        return device;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now( clock ).withOffsetSameInstant( ZoneOffset.UTC );
    }

    private static String sha256( String value ) {
        try {
            MessageDigest digest = MessageDigest.getInstance( "SHA-256" );
            return HexFormat.of().formatHex( digest.digest( value.getBytes( StandardCharsets.UTF_8 ) ) );
        } catch ( Exception ex ) {
            throw new IllegalStateException( ex );
        }
    }
}
