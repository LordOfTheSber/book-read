package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Именованный набор произведений с описанием. Состав задаётся вручную — этим полка отличается
 * от {@link SmartShelf}, где состав пересчитывается по сохранённому фильтру.
 */
@Entity
@Table( name = "shelves" )
@Getter
@Setter
public class Shelf extends BaseAuditEntity {

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

    /** Публичную полку видит по ссылке любой пользователь сервиса, а не только владелец. */
    @Column( name = "is_public", nullable = false )
    private boolean isPublic;

    @ManyToMany( fetch = FetchType.LAZY )
    @JoinTable(
            name = "shelf_items",
            joinColumns = @JoinColumn( name = "shelf_id" ),
            inverseJoinColumns = @JoinColumn( name = "item_id" )
    )
    private Set<LibraryItem> items = new LinkedHashSet<>();
}
