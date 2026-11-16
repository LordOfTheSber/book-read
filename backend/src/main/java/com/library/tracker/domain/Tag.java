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

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Свободная пометка в дополнение к справочнику {@link BookType}: тип — это жанр, тег — контекст
 * («на лето», «перечитать»). Личный, а не общий: «на лето» у двух пользователей значит разное.
 */
@Entity
@Table( name = "tags" )
@Getter
@Setter
public class Tag extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "owner_id", nullable = false )
    private User owner;

    @Column( name = "name", nullable = false, length = 64 )
    private String name;

    /** Цвет чипа в интерфейсе; null — нейтральный. */
    @Column( name = "color", length = 32 )
    private String color;
}
