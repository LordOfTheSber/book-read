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
 * Цель на год. Хранятся только цифры: прогресс считается по библиотеке и заходам, а не копится
 * в колонке — иначе удаление записи оставило бы счётчик завышенным навсегда.
 */
@Entity
@Table( name = "reading_goals" )
@Getter
@Setter
public class ReadingGoal extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "owner_id", nullable = false )
    private User owner;

    @Column( name = "year", nullable = false )
    private int year;

    /** Цели независимые: кто-то считает книгами, кто-то страницами, кто-то временем. */
    @Column( name = "target_items" )
    private Integer targetItems;

    @Column( name = "target_pages" )
    private Integer targetPages;

    @Column( name = "target_minutes" )
    private Integer targetMinutes;
}
