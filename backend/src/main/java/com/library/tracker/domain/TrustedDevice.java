package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Устройство, которому пользователь доверил вход без пароля.
 * <p>
 * Ни секрета, ни отпечатка в открытом виде здесь нет: {@link #tokenHash} и
 * {@link #fingerprintHash} — SHA-256 от них. Секрет существует ровно один раз, в ответе, где
 * ставится кука; сверить его потом можно только по хешу.
 */
@Entity
@Table( name = "trusted_devices" )
@Getter
@Setter
public class TrustedDevice extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.EAGER, optional = false )
    @JoinColumn( name = "user_id", nullable = false )
    private User user;

    @Column( name = "token_hash", nullable = false, unique = true, length = 64 )
    private String tokenHash;

    @Column( name = "fingerprint_hash", nullable = false, length = 64 )
    private String fingerprintHash;

    /** Что показать в списке устройств: «Chrome · Windows», «Safari · iPhone». */
    @Column( name = "label", nullable = false, length = 128 )
    private String label;

    @Column( name = "last_ip", length = 45 )
    private String lastIp;

    @Column( name = "last_used_at", nullable = false )
    private OffsetDateTime lastUsedAt;

    @Column( name = "expires_at", nullable = false )
    private OffsetDateTime expiresAt;
}
