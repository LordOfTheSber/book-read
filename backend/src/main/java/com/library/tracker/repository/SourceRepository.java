package com.library.tracker.repository;

import com.library.tracker.domain.Source;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceRepository extends JpaRepository<Source, UUID> {

    boolean existsByNameIgnoreCase( String name );
}
