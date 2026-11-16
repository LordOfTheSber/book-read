package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "session_settings" )
@Getter
@Setter
public class SessionSettings extends BaseAuditEntity {

    @Id
    private Long id = 1L;

    @Column( name = "session_ttl_minutes", nullable = false )
    private Integer sessionTtlMinutes;

    @Column( name = "max_session_lifetime_minutes", nullable = false )
    private Integer maxSessionLifetimeMinutes;
}
