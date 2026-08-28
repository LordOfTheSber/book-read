package com.library.tracker.service;

import com.library.tracker.domain.Author;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.User;
import com.library.tracker.repository.AuthorRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.AuthorRequest;
import com.library.tracker.web.dto.AuthorResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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

    /**
     * Слияние дублей: справочник авторов пополняется сам, когда имя вписывают в карточку, —
     * «Лю Цысинь» и «Cixin Liu» так становятся двумя авторами с одними и теми же книгами.
     * Произведения дубля переезжают к выбранному автору, сам дубль исчезает. Имя, которое
     * человек видел на дубле, не пропадает: если у цели нет второго имени, оно встаёт туда.
     */
    public AuthorResponse merge( UUID sourceId, UUID targetId ) {
        if ( sourceId.equals( targetId ) ) {
            throw new IllegalArgumentException( "Cannot merge author into itself" );
        }
        Author source = authorRepository.findById( sourceId )
                                        .orElseThrow( () -> new IllegalArgumentException( "Author not found" ) );
        Author target = authorRepository.findById( targetId )
                                        .orElseThrow( () -> new IllegalArgumentException( "Author not found" ) );

        List<LibraryItem> items = libraryItemRepository.findAllByAuthorId( sourceId );
        for ( LibraryItem item : items ) {
            item.getAuthors().remove( source );
            item.getAuthors().add( target );
        }
        libraryItemRepository.saveAll( items );

        if ( !StringUtils.hasText( target.getAltName() ) && !target.getName().equalsIgnoreCase( source.getName() ) ) {
            target.setAltName( source.getName() );
        }
        Author saved = authorRepository.save( target );
        authorRepository.delete( source );
        return toResponse( saved, itemCounts() );
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
                                                                count -> count ) );
    }

    private void applyRequest( Author author, AuthorRequest request ) {
        author.setName( request.getName().trim() );
        author.setAltName( StringUtils.hasText( request.getAltName() ) ? request.getAltName().trim() : null );
    }

    private AuthorResponse toResponse( Author author, Map<UUID, LibraryItemRepository.AuthorCount> counts ) {
        LibraryItemRepository.AuthorCount count = counts.get( author.getId() );
        return AuthorResponse.builder()
                             .id( author.getId() )
                             .name( author.getName() )
                             .altName( author.getAltName() )
                             .itemCount( count != null ? count.getCount() : 0 )
                             .finishedCount( count != null ? count.getCompletedCount() : 0 )
                             .averageRating( count != null ? count.getAverageRating() : null )
                             .createdAt( toOffsetDateTime( author.getCreatedAt() ) )
                             .updatedAt( toOffsetDateTime( author.getUpdatedAt() ) )
                             .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
