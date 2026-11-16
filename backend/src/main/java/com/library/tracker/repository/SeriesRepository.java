package com.library.tracker.repository;

import com.library.tracker.domain.Series;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesRepository extends JpaRepository<Series, UUID> {

    Optional<Series> findByNameIgnoreCase( String name );

    boolean existsByNameIgnoreCase( String name );

    List<Series> findAllByOrderByNameAsc();
}
