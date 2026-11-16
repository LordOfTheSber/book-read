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
@Table( name = "sources" )
@Getter
@Setter
public class Source extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Column( name = "name", nullable = false, unique = true )
    private String name;

    @Column( name = "url", nullable = false )
    private String url;

    @Column( name = "description", columnDefinition = "TEXT" )
    private String description;
}
