package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "users" )
@Getter
@Setter
public class User extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Column( name = "username", nullable = false, unique = true )
    private String username;

    @Column( name = "password", nullable = false )
    private String password;

    @Enumerated( EnumType.STRING )
    @Column( name = "role", nullable = false )
    private Role role = Role.USER;
}
