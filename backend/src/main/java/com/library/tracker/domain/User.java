package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table( name = "users" )
@Getter
@Setter
public class User extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Column( name = "username", nullable = false, unique = true )
    private String username;

    @Column( name = "password", nullable = false )
    private String password;

    @Enumerated( EnumType.STRING )
    @Column( name = "role", nullable = false )
    private Role role = Role.USER;

    @JdbcTypeCode( SqlTypes.BINARY )
    @Column( name = "avatar" )
    private byte[] avatar;

    @Column( name = "avatar_content_type" )
    private String avatarContentType;

    @Column( name = "session_ttl_override_minutes" )
    private Integer sessionTtlOverrideMinutes;

    @Column( name = "max_session_lifetime_override_minutes" )
    private Integer maxSessionLifetimeOverrideMinutes;

    @Column( name = "blocked", nullable = false )
    private boolean blocked = false;

    /**
     * Имя для показа отдельно от логина: логин участвует в адресе {@code /u/username} и в
     * аутентификации, поэтому менять его ради красивой подписи нельзя.
     */
    @Column( name = "display_name", length = 128 )
    private String displayName;

    @Column( name = "bio", columnDefinition = "TEXT" )
    private String bio;

    /** Профиль закрыт по умолчанию: открыть его — решение пользователя, а не следствие обновления. */
    @Column( name = "public_profile", nullable = false )
    private boolean publicProfile = false;
}
