package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.User;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.AuthorRequest;
import com.library.tracker.web.dto.AuthorResponse;
import com.library.tracker.web.dto.ShowcaseItemResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthorService {

    private final AuthorRepository authorRepository;
    private final LibraryItemRepository libraryItemRepository;
    private final UserService userService;
    private final ShowcaseAssembler showcaseAssembler;

    @Transactional( readOnly = true )
    public List<AuthorResponse> findAll( String query ) {
        List<Author> authors = StringUtils.hasText( query )
                ? authorRepository.findByNameContainingIgnoreCaseOrderByNameAsc( query.trim() )
                : authorRepository.findAllByOrderByNameAsc();
        Map<UUID, LibraryItemRepository.AuthorCount> counts = itemCounts();
        return authors.stream().map( author -> toResponse( author, counts ) ).toList();
    }

    @Transactional( readOnly = true )
    public Optional<AuthorResponse> findById( UUID id ) {
        Map<UUID, LibraryItemRepository.AuthorCount> counts = itemCounts();
        return authorRepository.findById( id ).map( author -> toResponse( author, counts ) );
    }

    /**
     * Обложки для показанных карточек справочника. Идентификаторы присылает страница: витрина
     * листается, и грузить обложки всех двухсот авторов ради восемнадцати видимых незачем.
     */
    @Transactional( readOnly = true )
    public Map<UUID, List<ShowcaseItemResponse>> showcase( Collection<UUID> authorIds ) {
        return showcaseAssembler.assemble( authorIds, libraryItemRepository::findShowcaseByAuthors );
    }

    /**
     * Слияние дублей: «Лю Цысинь» и «Cixin Liu» заводятся сами, когда имя вписывают в карточку
     * руками, и расходятся в два справочника. Записи уходящего автора переподвешиваются на
     * остающегося, после чего уходящий удаляется.
     */
    public Optional<AuthorResponse> merge( UUID targetId, UUID sourceId ) {
        if ( targetId.equals( sourceId ) ) {
            throw new IllegalArgumentException( "Cannot merge author into itself" );
        }
        Optional<Author> target = authorRepository.findById( targetId );
        Optional<Author> source = authorRepository.findById( sourceId );
        if ( target.isEmpty() || source.isEmpty() ) {
            return Optional.empty();
        }
        Author into = target.get();
        Author from = source.get();
        libraryItemRepository.findByAuthorId( from.getId() ).forEach( item -> {
            item.getAuthors().remove( from );
            item.getAuthors().add( into );
        } );
        // Записи держат связь на своей стороне, и до сохранения ссылка на уходящего ещё жива:
        // без сброса удаление упало бы на внешнем ключе.
        libraryItemRepository.flush();
        authorRepository.delete( from );
        return Optional.of( toResponse( into, itemCounts() ) );
    }

    public AuthorResponse create( AuthorRequest request ) {
        if ( authorRepository.existsByNameIgnoreCase( request.getName().trim() ) ) {
            throw new IllegalArgumentException( "Author name already exists" );
        }
        Author author = new Author();
        applyRequest( author, request );
        return toResponse( authorRepository.save( author ), itemCounts() );
    }

    public Optional<AuthorResponse> update( UUID id, AuthorRequest request ) {
        return authorRepository.findById( id ).map( existing -> {
            boolean nameChanged = !existing.getName().equalsIgnoreCase( request.getName().trim() );
            if ( nameChanged && authorRepository.existsByNameIgnoreCase( request.getName().trim() ) ) {
                throw new IllegalArgumentException( "Author name already exists" );
            }
            applyRequest( existing, request );
            return toResponse( authorRepository.save( existing ), itemCounts() );
        } );
    }

    public void delete( UUID id ) {
        if ( libraryItemRepository.existsByAuthorId( id ) ) {
            throw new IllegalStateException( "Cannot delete author in use" );
        }
        authorRepository.deleteById( id );
    }

    /**
     * Карточка произведения присылает имена, а не идентификаторы: заводить автора отдельным
     * действием ради одной книги — лишний шаг. Совпадение ищется без учёта регистра, поэтому
     * «Лю Цысинь» и «лю цысинь» остаются одним автором.
     */
    public Set<Author> resolveByNames( Collection<String> names ) {
        if ( names == null || names.isEmpty() ) {
            return Set.of();
        }
        Set<Author> resolved = new LinkedHashSet<>();
        Set<String> seen = new LinkedHashSet<>();
        for ( String rawName : names ) {
            String name = rawName == null ? "" : rawName.trim();
            if ( !StringUtils.hasText( name ) || !seen.add( name.toLowerCase() ) ) {
                continue;
            }
            resolved.add( authorRepository.findByNameIgnoreCase( name ).orElseGet( () -> {
                Author author = new Author();
                author.setName( name );
                return authorRepository.save( author );
            } ) );
        }
        return resolved;
    }

    /**
     * Считает произведения по авторам одним запросом. Обычный пользователь видит счётчики
     * по своей библиотеке, администратор — по всей.
     */
    private Map<UUID, LibraryItemRepository.AuthorCount> itemCounts() {
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();
        return libraryItemRepository.countByAuthor( scope ).stream()
                                    .collect( Collectors.toMap( LibraryItemRepository.AuthorCount::getAuthorId,
                                                                Function.identity() ) );
    }

    private void applyRequest( Author author, AuthorRequest request ) {
        author.setName( request.getName().trim() );
        author.setAltName( StringUtils.hasText( request.getAltName() ) ? request.getAltName().trim() : null );
    }

    private AuthorResponse toResponse( Author author, Map<UUID, LibraryItemRepository.AuthorCount> counts ) {
        LibraryItemRepository.AuthorCount stats = counts.get( author.getId() );
        return AuthorResponse.builder()
                             .id( author.getId() )
                             .name( author.getName() )
                             .altName( author.getAltName() )
                             .itemCount( stats != null ? stats.getCount() : 0L )
                             .finishedCount( stats != null ? stats.getFinishedCount() : 0L )
                             .avgRating( averageRating( stats ) )
                             .createdAt( toOffsetDateTime( author.getCreatedAt() ) )
                             .updatedAt( toOffsetDateTime( author.getUpdatedAt() ) )
                             .build();
    }

    /** Десятая доля: оценка выставляется с шагом 0,5, и «9,17» на карточке выглядит подсчётом. */
    private BigDecimal averageRating( LibraryItemRepository.AuthorCount stats ) {
        if ( stats == null || stats.getAvgRating() == null ) {
            return null;
        }
        return BigDecimal.valueOf( stats.getAvgRating() ).setScale( 1, RoundingMode.HALF_UP );
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
