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

/** Участник совместной полки: семейной или клубной. Владелец полки в участниках не числится. */
@Entity
@Table( name = "shelf_members" )
@Getter
@Setter
public class ShelfMember extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "shelf_id", nullable = false )
    private Shelf shelf;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "user_id", nullable = false )
    private User user;

    @Enumerated( EnumType.STRING )
    @Column( name = "role", nullable = false, length = 16 )
    private ShelfRole role = ShelfRole.VIEWER;
}
