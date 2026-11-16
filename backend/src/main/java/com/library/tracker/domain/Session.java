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

@Entity
@Table( name = "sessions" )
@Getter
@Setter
public class Session extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.EAGER, optional = false )
    @JoinColumn( name = "user_id", nullable = false )
    private User user;

    @Column( name = "expires_at", nullable = false )
    private OffsetDateTime expiresAt;

    @Column( name = "max_expires_at", nullable = false )
    private OffsetDateTime maxExpiresAt;
}
