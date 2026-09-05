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

/** Комментарий к отзыву. Плоский список без ответов: ветки в обсуждении одной книги не нужны. */
@Entity
@Table( name = "review_comments" )
@Getter
@Setter
public class ReviewComment extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "author_id", nullable = false )
    private User author;

    @Column( name = "body", nullable = false, columnDefinition = "TEXT" )
    private String body;
}
