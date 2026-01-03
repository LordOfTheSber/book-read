package com.library.tracker.repository;

import com.library.tracker.domain.SystemNode;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemNodeRepository extends JpaRepository<SystemNode, UUID> {

    Optional<SystemNode> findByNodeKey( String nodeKey );
}
