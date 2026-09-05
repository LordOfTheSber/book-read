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

import java.time.LocalDate;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Полученное достижение. Условие живёт в коде, здесь только факт и дата: порог и формулировку
 * переписывают, и хранить их строками значило бы чинить данные миграцией при каждой правке.
 */
@Entity
@Table( name = "user_achievements" )
@Getter
@Setter
public class UserAchievement extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "owner_id", nullable = false )
    private User owner;

    @Column( name = "code", nullable = false, length = 64 )
    private String code;

    /** Дата фиксируется в момент выдачи: задним числом достижение не переоткрывается. */
    @Column( name = "unlocked_on", nullable = false )
    private LocalDate unlockedOn;
}
