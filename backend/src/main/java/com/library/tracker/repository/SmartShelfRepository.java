package com.library.tracker.repository;

import com.library.tracker.domain.SmartShelf;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SmartShelfRepository extends JpaRepository<SmartShelf, UUID> {

    List<SmartShelf> findByOwnerIdOrderByNameAsc( UUID ownerId );

    boolean existsByOwnerIdAndNameIgnoreCase( UUID ownerId, String name );
}
