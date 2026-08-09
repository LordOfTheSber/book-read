package com.library.tracker.repository;

import com.library.tracker.domain.ReadingGoal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingGoalRepository extends JpaRepository<ReadingGoal, UUID> {

    Optional<ReadingGoal> findByOwnerIdAndYear( UUID ownerId, int year );

    List<ReadingGoal> findByOwnerIdOrderByYearDesc( UUID ownerId );
}
