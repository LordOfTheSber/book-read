package com.library.tracker.repository;

import com.library.tracker.domain.LibraryItem;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface LibraryItemRepository extends JpaRepository<LibraryItem, UUID>, JpaSpecificationExecutor<LibraryItem> {
    boolean existsByTypeId(UUID typeId);
}
