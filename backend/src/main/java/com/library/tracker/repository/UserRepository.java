package com.library.tracker.repository;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByUsernameIgnoreCase( String username );

    boolean existsByUsernameIgnoreCase( String username );

    java.util.List<User> findByUsernameContainingIgnoreCase( String username );

    long countByRole( Role role );

    /**
     * Кого из перечисленных видно другим. Закрытый профиль выпадает из ленты и из списков
     * целиком — фильтровать после выборки нельзя, срез уже ограничен количеством.
     */
    @Query( "select u.id from User u where u.id in :ids and u.publicProfile = true" )
    List<UUID> findPublicProfileIds( Collection<UUID> ids );

    /**
     * Поиск людей, на кого можно подписаться. Заблокированные и закрытые не показываются:
     * подписка на закрытый профиль всё равно ничего не покажет.
     */
    @Query( """
            select u
            from User u
            where u.publicProfile = true
              and u.blocked = false
              and lower(u.username) like lower(concat('%', :query, '%'))
            order by u.username
            """ )
    List<User> searchPublicProfiles( String query, Pageable pageable );
}
