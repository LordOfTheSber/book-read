package com.library.tracker.repository;

import com.library.tracker.domain.User;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByUsernameIgnoreCase( String username );

    boolean existsByUsernameIgnoreCase( String username );
}
