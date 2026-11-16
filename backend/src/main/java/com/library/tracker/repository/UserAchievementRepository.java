package com.library.tracker.repository;

import com.library.tracker.domain.UserAchievement;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAchievementRepository extends JpaRepository<UserAchievement, UUID> {

    List<UserAchievement> findByOwnerIdOrderByUnlockedOnAsc( UUID ownerId );
}
