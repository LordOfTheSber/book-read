package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;

import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Проверка доступа к произведению в одном месте. Заходы, проходы и цитаты — такие же личные записи,
 * как сама карточка, и правило у них общее: свои правит владелец, чужие — только администратор.
 * Разъехавшиеся копии этой проверки уже приводили к IDOR (P0-1 в роадмепе).
 */
@Component
@RequiredArgsConstructor
public class LibraryItemAccess {

    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public LibraryItem requireReadable( UUID itemId ) {
        return require( itemId, "Вы можете смотреть только свои книги" );
    }

    @Transactional( readOnly = true )
    public LibraryItem requireWritable( UUID itemId, String denialMessage ) {
        return require( itemId, denialMessage );
    }

    private LibraryItem require( UUID itemId, String denialMessage ) {
        User currentUser = userService.getCurrentUser();
        LibraryItem item = libraryItemRepository.findWithRelationsById( itemId )
                                                .orElseThrow( () -> new IllegalArgumentException( "Книга не найдена" ) );
        if ( !userService.isAdmin( currentUser ) && !isOwnedBy( item, currentUser ) ) {
            throw new AccessDeniedException( denialMessage );
        }
        return item;
    }

    public boolean isOwnedBy( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && item.getCreatedBy().getId().equals( user.getId() );
    }
}
