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

/** Выписка из произведения с номером страницы (или иной позиции) и личной пометкой. */
@Entity
@Table( name = "quotes" )
@Getter
@Setter
public class Quote extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    @Column( name = "position" )
    private Integer position;

    @Column( name = "text", nullable = false, columnDefinition = "TEXT" )
    private String text;

    @Column( name = "note", columnDefinition = "TEXT" )
    private String note;
}
