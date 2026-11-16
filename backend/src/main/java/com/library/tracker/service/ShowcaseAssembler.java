package com.library.tracker.service;

import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.ShowcaseItemResponse;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Витрина справочника: обложки, разложенные по карточкам авторов и серий.
 *
 * Авторы и серии различаются только запросом, поэтому и обрезка «не больше четырёх на карточку»,
 * и область видимости живут в одном месте: иначе два справочника разъезжаются по мелочам —
 * у одного пять обложек, у другого администратор считает по всей базе.
 */
@Service
@RequiredArgsConstructor
public class ShowcaseAssembler {

    /** Столько обложек помещается в ряд карточки; пятая ушла бы под «ещё N». */
    public static final int COVERS_PER_CARD = 4;

    private final UserService userService;

    public Map<UUID, List<ShowcaseItemResponse>> assemble(
            Collection<UUID> ownerIds,
            BiFunction<Collection<UUID>, UUID, List<LibraryItemRepository.ShowcaseRow>> query ) {
        if ( ownerIds == null || ownerIds.isEmpty() ) {
            return Map.of();
        }
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();

        Map<UUID, List<ShowcaseItemResponse>> byOwner = new LinkedHashMap<>();
        for ( LibraryItemRepository.ShowcaseRow row : query.apply( ownerIds, scope ) ) {
            List<ShowcaseItemResponse> covers = byOwner.computeIfAbsent( row.getOwnerId(), key -> new ArrayList<>() );
            if ( covers.size() >= COVERS_PER_CARD ) {
                continue;
            }
            covers.add( ShowcaseItemResponse.builder()
                                            .id( row.getItemId() )
                                            .title( row.getTitle() )
                                            .kind( row.getKind() )
                                            .status( row.getStatus() )
                                            .rating( row.getRating() )
                                            .hasCover( row.getCoverKey() != null )
                                            .build() );
        }
        return byOwner;
    }
}
