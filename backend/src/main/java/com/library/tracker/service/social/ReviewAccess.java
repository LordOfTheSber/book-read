package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.User;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.service.UserService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Кому виден отзыв. Правило одно на реакции, комментарии и чтение самого текста — разложенное
 * по вызывающим, оно неминуемо разъехалось бы, а расхождение здесь означает утечку чужой карточки.
 * <p>
 * Отзыв виден, если он есть и выполняется одно из трёх: это своя запись; профиль владельца открыт;
 * запись лежит на полке, которую спрашивающему и так видно. Приватная заметка не видна никогда
 * и никому — её просто нет в ответах социального слоя.
 */
@Component
@RequiredArgsConstructor
public class ReviewAccess {

    private final ShelfRepository shelfRepository;
    private final UserService userService;

    public boolean isOwner( LibraryItem item, User user ) {
        return item.getCreatedBy() != null && user != null && item.getCreatedBy().getId().equals( user.getId() );
    }

    @Transactional( readOnly = true )
    public boolean canSee( LibraryItem item, User user ) {
        if ( isOwner( item, user ) || userService.isAdmin( user ) ) {
            return true;
        }
        if ( !StringUtils.hasText( item.getReview() ) ) {
            return false;
        }
        if ( item.getCreatedBy() != null && item.getCreatedBy().isPublicProfile() ) {
            return true;
        }
        return shelfRepository.existsReadableShelfWithItem( item.getId(), user.getId() );
    }
}
