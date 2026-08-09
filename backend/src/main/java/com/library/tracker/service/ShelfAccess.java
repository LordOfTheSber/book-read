package com.library.tracker.service;

import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.ShelfMember;
import com.library.tracker.domain.ShelfRole;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ShelfMemberRepository;

import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Права на полку в одном месте. У полки их теперь три источника — владелец, признак публичности
 * и список участников, — и держать эту тройку разложенной по вызывающим значит завести
 * расхождение, из которого уже однажды вырос IDOR (P0-1 в роадмепе).
 * <p>
 * Роль внутри полки не выводится из глобальной: администратор сервиса видит чужую полку, но
 * не становится её куратором — состав семейной полки правит семья.
 */
@Component
@RequiredArgsConstructor
public class ShelfAccess {

    private final ShelfMemberRepository shelfMemberRepository;
    private final UserService userService;

    public boolean isOwner( Shelf shelf, User user ) {
        return shelf.getOwner() != null && user != null && shelf.getOwner().getId().equals( user.getId() );
    }

    @Transactional( readOnly = true )
    public Optional<ShelfRole> memberRole( Shelf shelf, User user ) {
        if ( user == null || shelf.getId() == null ) {
            return Optional.empty();
        }
        return shelfMemberRepository.findByShelfIdAndUserId( shelf.getId(), user.getId() )
                                    .map( ShelfMember::getRole );
    }

    /** Читают: владелец, участник любой роли, любой пользователь публичной полки и администратор. */
    @Transactional( readOnly = true )
    public boolean canRead( Shelf shelf, User user ) {
        return shelf.isPublic()
               || isOwner( shelf, user )
               || userService.isAdmin( user )
               || memberRole( shelf, user ).isPresent();
    }

    /** Правят саму полку и её состав целиком: владелец и куратор. */
    @Transactional( readOnly = true )
    public boolean canCurate( Shelf shelf, User user ) {
        return isOwner( shelf, user ) || memberRole( shelf, user ).filter( ShelfRole.CURATOR::equals ).isPresent();
    }

    /** Пополняют полку: куратор — чем угодно из видимого, участник — только своими записями. */
    @Transactional( readOnly = true )
    public boolean canContribute( Shelf shelf, User user ) {
        return canCurate( shelf, user )
               || memberRole( shelf, user ).filter( ShelfRole.CONTRIBUTOR::equals ).isPresent();
    }
}
