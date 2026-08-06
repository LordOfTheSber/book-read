package com.library.tracker.integration;

import com.library.tracker.config.JpaConfig;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.SavedFilter;
import com.library.tracker.domain.Shelf;
import com.library.tracker.domain.SmartShelf;
import com.library.tracker.domain.Tag;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.repository.ShelfRepository;
import com.library.tracker.repository.SmartShelfRepository;
import com.library.tracker.repository.TagRepository;
import com.library.tracker.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Проверяет миграцию V14 против маппинга на настоящей PostgreSQL: теги, полки, умные полки
 * и поля списка желаемого. Заодно проверяются два запроса раздела 5, которые без Postgres
 * проверить нечем: поиск дублей по нормализованному ISBN и нечёткое совпадение названия
 * через pg_trgm.
 */
@DataJpaTest
@AutoConfigureTestDatabase( replace = AutoConfigureTestDatabase.Replace.NONE )
@Import( JpaConfig.class )
class LibraryOrganizationIntegrationTest extends PostgresContainerTest {

    @Autowired
    private LibraryItemRepository libraryItemRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private ShelfRepository shelfRepository;

    @Autowired
    private SmartShelfRepository smartShelfRepository;

    @Autowired
    private UserRepository userRepository;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = userRepository.saveAndFlush( user( "reader-" + UUID.randomUUID() ) );
    }

    @Test
    void tagsAreScopedToOwnerAndCaseInsensitive() {
        tagRepository.saveAndFlush( tag( "На лето", owner ) );

        // «На лето» и «на лето» — одна пометка: тег заводится по имени из карточки.
        assertThatThrownBy( () -> tagRepository.saveAndFlush( tag( "на лето", owner ) ) )
                .isInstanceOf( DataIntegrityViolationException.class );
    }

    @Test
    void sameTagNameBelongsToDifferentOwnersIndependently() {
        User other = userRepository.saveAndFlush( user( "other-" + UUID.randomUUID() ) );

        tagRepository.saveAndFlush( tag( "на лето", owner ) );
        Tag foreign = tagRepository.saveAndFlush( tag( "на лето", other ) );

        assertThat( tagRepository.findByOwnerIdOrderByNameAsc( other.getId() ) ).containsExactly( foreign );
        assertThat( tagRepository.findByOwnerIdOrderByNameAsc( owner.getId() ) ).hasSize( 1 );
    }

    @Test
    void itemKeepsTagsAndShelfMembership() {
        Tag tag = tagRepository.saveAndFlush( tag( "перечитать", owner ) );
        LibraryItem item = libraryItemRepository.saveAndFlush( item( "Задача трёх тел", "9785171049676" ) );
        item.setTags( Set.of( tag ) );
        libraryItemRepository.saveAndFlush( item );

        Shelf shelf = shelf( "Книжный клуб", owner );
        shelf.getItems().add( item );
        Shelf saved = shelfRepository.saveAndFlush( shelf );

        Shelf loaded = shelfRepository.findWithItemsById( saved.getId() ).orElseThrow();
        assertThat( loaded.getItems() ).extracting( LibraryItem::getTitle ).containsExactly( "Задача трёх тел" );
        assertThat( shelfRepository.countItemsByShelf( owner.getId() ) ).singleElement()
                                                                       .extracting( ShelfRepository.ShelfCount::getCount )
                                                                       .isEqualTo( 1L );
        assertThat( tagRepository.findTagsByItemIds( List.of( item.getId() ) ) ).singleElement()
                                                                               .extracting( TagRepository.ItemTagRow::getName )
                                                                               .isEqualTo( "перечитать" );
    }

    /** Фильтр умной полки хранится объектом в jsonb и должен пережить обход через БД целиком. */
    @Test
    void smartShelfStoresWholeFilter() {
        SmartShelf shelf = new SmartShelf();
        shelf.setOwner( owner );
        shelf.setName( "Непрочитанная фантастика" );
        SavedFilter filter = new SavedFilter();
        filter.setStatus( ReadingStatus.PLANNED );
        filter.setMinRating( new BigDecimal( "8.0" ) );
        filter.setQuery( "фантастика" );
        filter.setWishlist( true );
        shelf.setFilter( filter );

        SmartShelf saved = smartShelfRepository.saveAndFlush( shelf );
        smartShelfRepository.flush();

        SavedFilter loaded = smartShelfRepository.findById( saved.getId() ).orElseThrow().getFilter();
        assertThat( loaded.getStatus() ).isEqualTo( ReadingStatus.PLANNED );
        assertThat( loaded.getMinRating() ).isEqualByComparingTo( "8.0" );
        assertThat( loaded.getQuery() ).isEqualTo( "фантастика" );
        assertThat( loaded.getWishlist() ).isTrue();
    }

    @Test
    void wishlistFieldsSurviveRoundTrip() {
        LibraryItem item = item( "Пиранези", null );
        item.setWishlist( true );
        item.setPrice( new BigDecimal( "899.00" ) );
        item.setCurrency( "RUB" );
        item.setPurchaseUrl( "https://example.com/piranesi" );

        LibraryItem loaded = libraryItemRepository.findById( libraryItemRepository.saveAndFlush( item ).getId() )
                                                  .orElseThrow();

        assertThat( loaded.isWishlist() ).isTrue();
        assertThat( loaded.getPrice() ).isEqualByComparingTo( "899.00" );
        assertThat( loaded.getCurrency() ).isEqualTo( "RUB" );
    }

    /** «978-5-17-104967-6» и «9785171049676» — одна книга, и детектор дублей обязан это видеть. */
    @Test
    void findsDuplicateByIsbnRegardlessOfHyphens() {
        LibraryItem item = item( "Задача трёх тел", "978-5-17-104967-6" );
        item.setCreatedBy( owner );
        libraryItemRepository.saveAndFlush( item );

        assertThat( libraryItemRepository.findByNormalizedIsbn( "9785171049676", owner.getId() ) ).hasSize( 1 );
    }

    /** Название с «е» вместо «ё» — самый частый способ завести вторую копию одной книги. */
    @Test
    void findsSimilarTitleThroughTrigrams() {
        LibraryItem item = item( "Задача трёх тел", null );
        item.setCreatedBy( owner );
        libraryItemRepository.saveAndFlush( item );

        assertThat( libraryItemRepository.findSimilarByTitle( "Задача трех тел", owner.getId() ) ).hasSize( 1 );
        assertThat( libraryItemRepository.findSimilarByTitle( "Совсем другая книга", owner.getId() ) ).isEmpty();
    }

    private User user( String username ) {
        User user = new User();
        user.setUsername( username );
        user.setPassword( "irrelevant" );
        user.setRole( Role.USER );
        return user;
    }

    private Tag tag( String name, User owner ) {
        Tag tag = new Tag();
        tag.setName( name );
        tag.setOwner( owner );
        return tag;
    }

    private Shelf shelf( String name, User owner ) {
        Shelf shelf = new Shelf();
        shelf.setName( name );
        shelf.setOwner( owner );
        return shelf;
    }

    private LibraryItem item( String title, String isbn ) {
        LibraryItem item = new LibraryItem();
        item.setTitle( title );
        item.setStatus( ReadingStatus.PLANNED );
        item.setIsbn( isbn );
        return item;
    }
}
