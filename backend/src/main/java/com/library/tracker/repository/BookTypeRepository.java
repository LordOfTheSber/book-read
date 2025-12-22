package com.library.tracker.repository;

import com.library.tracker.domain.BookType;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BookTypeRepository extends JpaRepository<BookType, UUID> {

    boolean existsByNameIgnoreCase( String name );
}
