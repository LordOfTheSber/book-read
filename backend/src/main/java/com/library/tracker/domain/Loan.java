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

/**
 * Выданный экземпляр. Заёмщик — просто имя, а не пользователь сервиса: книги чаще отдают тем,
 * кого здесь нет, и требовать регистрации ради записи «у Ани с марта» незачем.
 */
@Entity
@Table( name = "loans" )
@Getter
@Setter
public class Loan extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @ManyToOne( fetch = FetchType.LAZY, optional = false )
    @JoinColumn( name = "item_id", nullable = false )
    private LibraryItem item;

    @Column( name = "borrower_name", nullable = false, length = 128 )
    private String borrowerName;

    @Column( name = "borrower_contact", length = 255 )
    private String borrowerContact;

    @Column( name = "lent_on", nullable = false )
    private LocalDate lentOn;

    /** Когда обещали вернуть; без даты напоминать не о чем. */
    @Column( name = "due_on" )
    private LocalDate dueOn;

    /** Пока пусто — экземпляр на руках. */
    @Column( name = "returned_on" )
    private LocalDate returnedOn;

    @Column( name = "note", columnDefinition = "TEXT" )
    private String note;
}
