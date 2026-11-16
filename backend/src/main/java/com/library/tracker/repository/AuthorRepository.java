package com.library.tracker.repository;

import com.library.tracker.domain.Author;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorRepository extends JpaRepository<Author, UUID> {

    Optional<Author> findByNameIgnoreCase( String name );

    boolean existsByNameIgnoreCase( String name );

    List<Author> findByNameContainingIgnoreCaseOrderByNameAsc( String name );

    List<Author> findAllByOrderByNameAsc();
}
