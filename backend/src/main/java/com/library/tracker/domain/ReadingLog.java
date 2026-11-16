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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/**
 * Один проход по произведению. Перечитывание — это новая попытка, а не перезапись единственного
 * статуса: у каждого прохода свои даты и своя оценка.
 */
@Entity
@Table( name = "reading_logs" )
@Getter
@Setter
public class ReadingLog extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    /** Порядковый номер прохода, начиная с единицы. */
    @Column( name = "attempt", nullable = false )
    private int attempt;

    @Column( name = "started_at" )
    private LocalDate startedAt;

    @Column( name = "finished_at" )
    private LocalDate finishedAt;

    @Column( name = "rating", precision = 3, scale = 1 )
    private BigDecimal rating;

    /** Критерии сохраняются в проходе: при перечитывании оценки обычно расходятся. */
    @Column( name = "rating_plot", precision = 3, scale = 1 )
    private BigDecimal ratingPlot;

    @Column( name = "rating_style", precision = 3, scale = 1 )
    private BigDecimal ratingStyle;

    @Column( name = "rating_characters", precision = 3, scale = 1 )
    private BigDecimal ratingCharacters;

    @Column( name = "rating_ending", precision = 3, scale = 1 )
    private BigDecimal ratingEnding;

    @Column( name = "comment", columnDefinition = "TEXT" )
    private String comment;
}
