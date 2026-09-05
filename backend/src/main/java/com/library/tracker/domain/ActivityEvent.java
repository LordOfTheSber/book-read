package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Запись в ленте. Лента пишется событиями, а не собирается запросом по текущему состоянию:
 * «дочитал» должно остаться в ленте, даже если книгу потом вернули в «читаю» или переоценили.
 * По той же причине подпись сохраняется снимком — переименованная полка не переписывает историю.
 */
@Entity
@Table( name = "activity_events" )
@Getter
@Setter
public class ActivityEvent extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "actor_id", nullable = false )
    private User actor;

    @Enumerated( EnumType.STRING )
    @Column( name = "type", nullable = false, length = 32 )
    private ActivityType type;

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "item_id" )
    private LibraryItem item;

    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "shelf_id" )
    private Shelf shelf;

    /** Название произведения или полки на момент события. */
    @Column( name = "subject", length = 512 )
    private String subject;

    /** Уточнение: оценка, название достижения, цифра цели. */
    @Column( name = "detail", length = 512 )
    private String detail;
}
