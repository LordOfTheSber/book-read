package com.library.tracker.repository;

import com.library.tracker.domain.Session;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;

public interface SessionRepository extends CrudRepository<Session, UUID> {

    @EntityGraph( attributePaths = "user" )
    Optional<Session> findById( UUID id );

    @Modifying
    @Query( "DELETE FROM Session s WHERE s.expiresAt < :now" )
    void deleteExpired( OffsetDateTime now );

    @Modifying
    @Query( "DELETE FROM Session s WHERE s.user.id = :userId" )
    void deleteAllByUserId( UUID userId );
}
