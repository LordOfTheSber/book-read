package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "authors" )
@Getter
@Setter
public class Author extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Column( name = "name", nullable = false )
    private String name;

    /** Имя в оригинальной записи: «Liu Cixin» рядом с «Лю Цысинь». */
    @Column( name = "alt_name" )
    private String altName;
}
