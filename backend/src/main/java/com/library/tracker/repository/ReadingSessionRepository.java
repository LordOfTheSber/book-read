package com.library.tracker.repository;

import com.library.tracker.domain.ReadingSession;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, UUID> {

    List<ReadingSession> findByItemIdOrderBySessionDateDescCreatedAtDesc( UUID itemId );
}
