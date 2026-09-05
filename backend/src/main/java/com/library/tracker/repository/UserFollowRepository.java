package com.library.tracker.repository;

import com.library.tracker.domain.UserFollow;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserFollowRepository extends JpaRepository<UserFollow, UUID> {

    Optional<UserFollow> findByFollowerIdAndFolloweeId( UUID followerId, UUID followeeId );

    boolean existsByFollowerIdAndFolloweeId( UUID followerId, UUID followeeId );

    long countByFollowerId( UUID followerId );

    long countByFolloweeId( UUID followeeId );

    /** Списки подписок показываются с аватарами, поэтому пользователь тянется тем же запросом. */
    @EntityGraph( attributePaths = { "followee" } )
    List<UserFollow> findByFollowerIdOrderByCreatedAtDesc( UUID followerId );

    @EntityGraph( attributePaths = { "follower" } )
    List<UserFollow> findByFolloweeIdOrderByCreatedAtDesc( UUID followeeId );

    /** Идентификаторы для ленты: сами подписки там не нужны, только по кому фильтровать. */
    @Query( "select f.followee.id from UserFollow f where f.follower.id = :followerId" )
    List<UUID> findFolloweeIds( UUID followerId );
}
