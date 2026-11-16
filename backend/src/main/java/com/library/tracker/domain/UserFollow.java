package com.library.tracker.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Подписка односторонняя: подтверждения нет, потому что подписаться можно только на открытый
 * профиль — владелец уже согласился показывать его любому пользователю сервиса.
 */
@Entity
@Table( name = "user_follows" )
@Getter
@Setter
public class UserFollow extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "follower_id", nullable = false )
    private User follower;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "followee_id", nullable = false )
    private User followee;
}
