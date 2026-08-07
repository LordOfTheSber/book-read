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

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Сохранённый фильтр как объект. Состав не хранится: полка «непрочитанная фантастика с оценкой
 * выше восьми» должна отвечать на вопрос сегодняшним содержимым библиотеки, а не вчерашним.
 * <p>
 * Параметры лежат объектом, а не колонкой на каждый: список фильтров растёт, и колоночная схема
 * требовала бы миграции при каждом новом параметре.
 */
@Entity
@Table( name = "smart_shelves" )
@Getter
@Setter
public class SmartShelf extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "owner_id", nullable = false )
    private User owner;

    @Column( name = "name", nullable = false, length = 128 )
    private String name;

    @Column( name = "description", columnDefinition = "TEXT" )
    private String description;

    @JdbcTypeCode( SqlTypes.JSON )
    @Column( name = "filter", nullable = false, columnDefinition = "jsonb" )
    private SavedFilter filter = new SavedFilter();
}
