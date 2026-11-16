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

import java.time.LocalDate;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

/** Заход: сколько прочитано за раз и за какое время. Из них складываются история и темп. */
@Entity
@Table( name = "reading_sessions" )
@Getter
@Setter
public class ReadingSession extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    /** Проход, к которому относится заход: иначе перечитывания смешались бы в одну историю. */
    @ManyToOne( fetch = FetchType.LAZY )
    @JoinColumn( name = "log_id" )
    private ReadingLog log;

    @Column( name = "session_date", nullable = false )
    private LocalDate sessionDate;

    @Column( name = "from_position" )
    private Integer fromPosition;

    @Column( name = "to_position" )
    private Integer toPosition;

    @Column( name = "duration_minutes" )
    private Integer durationMinutes;

    @Column( name = "note", columnDefinition = "TEXT" )
    private String note;
}
