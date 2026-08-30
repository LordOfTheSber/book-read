package com.library.tracker.service;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.web.dto.TagDuplicateResponse;
import com.library.tracker.web.dto.TagRequest;
import com.library.tracker.web.dto.TagResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Теги — свободные пометки в дополнение к справочнику типов: тип это жанр, тег — контекст.
 * В отличие от типов и авторов тег личный, поэтому и справочник, и проверка доступа тут свои:
 * администратор видит свои теги, а не сумму по базе.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class TagService {

    /**
     * Порог, с которого пересечение перестаёт быть совпадением: если меньший тег на семь восьмых
     * лежит внутри большего, это одно и то же другими словами. Ниже — просто соседние пометки
     * («фантастика» и «космос» тоже часто стоят вместе, но одним тегом не являются).
     */
    private static final double DUPLICATE_RATIO = 0.7;

    /** На двух-трёх записях совпадение случайно: подсказка нужна там, где ручная уборка дорога. */
    private static final long DUPLICATE_MIN_ITEMS = 3;

    private final TagRepository tagRepository;
    private final LibraryItemRepository itemRepository;
    private final UserService userService;

    @Transactional( readOnly = true )
    public List<TagResponse> findAll() {
        User currentUser = userService.getCurrentUser();
        Map<UUID, Long> counts = itemCounts( currentUser.getId() );
        return tagRepository.findByOwnerIdOrderByNameAsc( currentUser.getId() ).stream()
                            .map( tag -> toResponse( tag, counts ) )
                            .toList();
    }

    public TagResponse create( TagRequest request ) {
        User currentUser = userService.getCurrentUser();
        String name = request.getName().trim();
        if ( tagRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
            throw new IllegalArgumentException( "Тег с таким названием уже есть" );
        }
        Tag tag = new Tag();
        tag.setOwner( currentUser );
        applyRequest( tag, request );
        return toResponse( tagRepository.save( tag ), itemCounts( currentUser.getId() ) );
    }

    public Optional<TagResponse> update( UUID id, TagRequest request ) {
        User currentUser = userService.getCurrentUser();
        return tagRepository.findById( id ).map( tag -> {
            requireOwner( tag, currentUser );
            String name = request.getName().trim();
            if ( !tag.getName().equalsIgnoreCase( name )
                 && tagRepository.existsByOwnerIdAndNameIgnoreCase( currentUser.getId(), name ) ) {
                throw new IllegalArgumentException( "Тег с таким названием уже есть" );
            }
            applyRequest( tag, request );
            return toResponse( tagRepository.save( tag ), itemCounts( currentUser.getId() ) );
        } );
    }

    /**
     * Тег удаляется вместе с пометками: в отличие от типа и автора он ничего не описывает,
     * поэтому «тег в использовании» не повод отказать — снять пометку и есть цель удаления.
     */
    public void delete( UUID id ) {
        User currentUser = userService.getCurrentUser();
        tagRepository.findById( id ).ifPresent( tag -> {
            requireOwner( tag, currentUser );
            tagRepository.delete( tag );
        } );
    }

    /**
     * Пары тегов, похожих на дубли. Считаются по пересечению записей, а не по написанию:
     * дубль — это когда две пометки стоят на одних и тех же книгах, как бы они ни назывались.
     */
    @Transactional( readOnly = true )
    public List<TagDuplicateResponse> findDuplicates() {
        User currentUser = userService.getCurrentUser();
        Map<UUID, Long> counts = itemCounts( currentUser.getId() );
        Map<UUID, Tag> tags = tagRepository.findByOwnerIdOrderByNameAsc( currentUser.getId() ).stream()
                                           .collect( Collectors.toMap( Tag::getId, tag -> tag ) );

        List<TagDuplicateResponse> found = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for ( TagRepository.TagOverlap overlap : tagRepository.overlaps( currentUser.getId() ) ) {
            Tag first = tags.get( overlap.getFirstId() );
            Tag second = tags.get( overlap.getSecondId() );
            if ( first == null || second == null ) {
                continue;
            }
            long firstCount = counts.getOrDefault( first.getId(), 0L );
            long secondCount = counts.getOrDefault( second.getId(), 0L );
            // Меньший тег и решает: он целиком лежит внутри большего — значит, лишний.
            Tag source = firstCount <= secondCount ? first : second;
            Tag target = source == first ? second : first;
            long sourceCount = Math.min( firstCount, secondCount );
            if ( sourceCount < DUPLICATE_MIN_ITEMS
                 || (double) overlap.getOverlap() / sourceCount < DUPLICATE_RATIO
                 || !seen.add( pairKey( source.getId(), target.getId() ) ) ) {
                continue;
            }
            found.add( TagDuplicateResponse.builder()
                                           .source( toResponse( source, counts ) )
                                           .target( toResponse( target, counts ) )
                                           .overlap( overlap.getOverlap() )
                                           .build() );
        }
        // Сначала самые очевидные: подсказка показывается по одной, и первой должна идти лучшая.
        found.sort( ( a, b ) -> Long.compare( b.getOverlap(), a.getOverlap() ) );
        return found;
    }

    /**
     * Объединение тегов: пометки переезжают на другой тег, исходный исчезает. Ручная уборка
     * того же — это открыть каждую запись и переставить пометку, поэтому действие и живёт
     * в справочнике, а не в карточке.
     */
    public TagResponse merge( UUID sourceId, UUID targetId ) {
        if ( sourceId.equals( targetId ) ) {
            throw new IllegalArgumentException( "Тег нельзя объединить сам с собой" );
        }
        User currentUser = userService.getCurrentUser();
        Tag source = tagRepository.findById( sourceId )
                                  .orElseThrow( () -> new IllegalArgumentException( "Тег не найден" ) );
        Tag target = tagRepository.findById( targetId )
                                  .orElseThrow( () -> new IllegalArgumentException( "Тег не найден" ) );
        requireOwner( source, currentUser );
        requireOwner( target, currentUser );

        for ( LibraryItem item : itemRepository.findByTagId( sourceId ) ) {
            item.getTags().remove( source );
            item.getTags().add( target );
        }
        tagRepository.delete( source );
        return toResponse( target, itemCounts( currentUser.getId() ) );
    }

    /** Пара без порядка: «а с б» и «б с а» — одно подозрение, а запрос отдаёт оба. */
    private String pairKey( UUID first, UUID second ) {
        return first + "|" + second;
    }

    /**
     * Теги приходят из карточки именами: заводить тег отдельным действием ради одной книги —
     * лишний шаг. Совпадение ищется без учёта регистра в пределах владельца.
     */
    public Set<Tag> resolveByNames( Collection<String> names, User owner ) {
        if ( names == null || names.isEmpty() ) {
            return Set.of();
        }
        Set<Tag> resolved = new LinkedHashSet<>();
        Set<String> seen = new LinkedHashSet<>();
        for ( String rawName : names ) {
            String name = rawName == null ? "" : rawName.trim();
            if ( !StringUtils.hasText( name ) || !seen.add( name.toLowerCase() ) ) {
                continue;
            }
            resolved.add( tagRepository.findByOwnerIdAndNameIgnoreCase( owner.getId(), name )
                                       .orElseGet( () -> {
                                           Tag tag = new Tag();
                                           tag.setOwner( owner );
                                           tag.setName( name.length() > 64 ? name.substring( 0, 64 ) : name );
                                           return tagRepository.save( tag );
                                       } ) );
        }
        return resolved;
    }

    private void requireOwner( Tag tag, User currentUser ) {
        if ( tag.getOwner() == null || !tag.getOwner().getId().equals( currentUser.getId() ) ) {
            throw new AccessDeniedException( "Вы можете править только свои теги" );
        }
    }

    private Map<UUID, Long> itemCounts( UUID ownerId ) {
        return tagRepository.countByTag( ownerId ).stream()
                            .collect( Collectors.toMap( TagRepository.TagCount::getTagId,
                                                        TagRepository.TagCount::getCount ) );
    }

    private void applyRequest( Tag tag, TagRequest request ) {
        tag.setName( request.getName().trim() );
        tag.setColor( StringUtils.hasText( request.getColor() ) ? request.getColor().trim() : null );
    }

    private TagResponse toResponse( Tag tag, Map<UUID, Long> counts ) {
        return TagResponse.builder()
                          .id( tag.getId() )
                          .name( tag.getName() )
                          .color( tag.getColor() )
                          .itemCount( counts.getOrDefault( tag.getId(), 0L ) )
                          .createdAt( toOffsetDateTime( tag.getCreatedAt() ) )
                          .updatedAt( toOffsetDateTime( tag.getUpdatedAt() ) )
                          .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
