package com.library.tracker.storage;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FilesystemObjectStorageTest {

    @TempDir
    Path root;

    private FilesystemObjectStorage storage;

    @BeforeEach
    void setUp() {
        storage = new FilesystemObjectStorage( root.toString() );
    }

    @Test
    void storesAndReadsBackContentWithItsType() {
        storage.put( "covers/one", "картинка".getBytes( StandardCharsets.UTF_8 ), "image/png" );

        Optional<StoredObject> stored = storage.get( "covers/one" );

        assertThat( stored ).isPresent();
        assertThat( new String( stored.get().content(), StandardCharsets.UTF_8 ) ).isEqualTo( "картинка" );
        assertThat( stored.get().contentType() ).isEqualTo( "image/png" );
    }

    @Test
    void replacesObjectUnderSameKey() {
        storage.put( "covers/one", "первая".getBytes( StandardCharsets.UTF_8 ), "image/png" );
        storage.put( "covers/one", "вторая".getBytes( StandardCharsets.UTF_8 ), "image/webp" );

        StoredObject stored = storage.get( "covers/one" ).orElseThrow();

        assertThat( new String( stored.content(), StandardCharsets.UTF_8 ) ).isEqualTo( "вторая" );
        assertThat( stored.contentType() ).isEqualTo( "image/webp" );
    }

    @Test
    void returnsEmptyForMissingKey() {
        assertThat( storage.get( "covers/missing" ) ).isEmpty();
    }

    @Test
    void deleteRemovesContentAndTypeAndIsIdempotent() throws Exception {
        storage.put( "covers/one", new byte[] { 1, 2, 3 }, "image/png" );

        storage.delete( "covers/one" );
        storage.delete( "covers/one" );

        assertThat( storage.get( "covers/one" ) ).isEmpty();
        try ( var entries = Files.list( root.resolve( "covers" ) ) ) {
            assertThat( entries ).isEmpty();
        }
    }

    /** Ключ приходит из приложения, но обход каталога всё равно должен отбиваться. */
    @Test
    void rejectsKeyEscapingTheStorageRoot() {
        assertThatThrownBy( () -> storage.put( "../outside", new byte[] { 1 }, "image/png" ) )
                .isInstanceOf( IllegalArgumentException.class )
                .hasMessageContaining( "Недопустимый ключ" );
    }
}
