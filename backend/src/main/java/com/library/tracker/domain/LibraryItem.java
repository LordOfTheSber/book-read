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
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "library_items")
@Getter
@Setter
public class LibraryItem extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false)
    private MediaKind kind = MediaKind.BOOK;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "alt_title")
    private String altTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_id")
    private BookType type;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "rating", precision = 3, scale = 1)
    private BigDecimal rating;

    @Column(name = "favorite", nullable = false)
    private boolean favorite;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ReadingStatus status = ReadingStatus.PLANNED;
}
