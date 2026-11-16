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

/** Реакция на отзыв к произведению. Пара «произведение — пользователь» уникальна. */
@Entity
@Table( name = "review_reactions" )
@Getter
@Setter
public class ReviewReaction extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "user_id", nullable = false )
    private User user;

    @Enumerated( EnumType.STRING )
    @Column( name = "kind", nullable = false, length = 32 )
    private ReactionKind kind;
}
