package com.library.tracker.repository;

import com.library.tracker.domain.TrustedDevice;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;

public interface TrustedDeviceRepository extends CrudRepository<TrustedDevice, UUID> {

    @EntityGraph( attributePaths = "user" )
    Optional<TrustedDevice> findByTokenHash( String tokenHash );

    Optional<TrustedDevice> findByUserIdAndFingerprintHash( UUID userId, String fingerprintHash );

    List<TrustedDevice> findByUserIdOrderByLastUsedAtDesc( UUID userId );

    @Modifying
    @Query( "DELETE FROM TrustedDevice d WHERE d.expiresAt < :now" )
    void deleteExpired( OffsetDateTime now );

    @Modifying
    @Query( "DELETE FROM TrustedDevice d WHERE d.user.id = :userId" )
    void deleteAllByUserId( UUID userId );
}
