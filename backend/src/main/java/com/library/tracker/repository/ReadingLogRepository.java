package com.library.tracker.repository;

import com.library.tracker.domain.ReadingLog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, UUID> {

    List<ReadingLog> findByItemIdOrderByAttemptAsc( UUID itemId );

    /** Текущий проход — это последний по номеру. */
    Optional<ReadingLog> findFirstByItemIdOrderByAttemptDesc( UUID itemId );
}
