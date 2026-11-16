package com.library.tracker.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Хранилище по умолчанию: файлы рядом с приложением. Разработке и тестам этого достаточно,
 * а для нескольких реплик нужен S3 — см. {@link S3ObjectStorage}.
 */
@Component
@ConditionalOnProperty( name = "storage.type", havingValue = "filesystem", matchIfMissing = true )
@Slf4j
public class FilesystemObjectStorage implements ObjectStorage {

    private final Path root;

    public FilesystemObjectStorage( @Value( "${storage.filesystem.path:storage}" ) String path ) {
        this.root = Paths.get( path ).toAbsolutePath();
        log.info( "Обложки хранятся в файловой системе: {}", root );
    }

    @Override
    public void put( String key, byte[] content, String contentType ) {
        Path target = resolve( key );
        try {
            Files.createDirectories( target.getParent() );
            Files.write( target, content );
            // Тип пишем рядом: файловая система своих метаданных для этого не даёт.
            Files.writeString( contentTypePath( target ), contentType == null ? "" : contentType,
                               StandardCharsets.UTF_8 );
        } catch ( IOException ex ) {
            throw new UncheckedIOException( "Не удалось сохранить объект " + key, ex );
        }
    }

    @Override
    public Optional<StoredObject> get( String key ) {
        Path target = resolve( key );
        if ( !Files.isRegularFile( target ) ) {
            return Optional.empty();
        }
        try {
            byte[] content = Files.readAllBytes( target );
            Path typePath = contentTypePath( target );
            String contentType = Files.isRegularFile( typePath )
                    ? Files.readString( typePath, StandardCharsets.UTF_8 )
                    : null;
            return Optional.of( new StoredObject( content, contentType == null || contentType.isBlank()
                    ? null
                    : contentType ) );
        } catch ( IOException ex ) {
            throw new UncheckedIOException( "Не удалось прочитать объект " + key, ex );
        }
    }

    @Override
    public void delete( String key ) {
        Path target = resolve( key );
        try {
            Files.deleteIfExists( target );
            Files.deleteIfExists( contentTypePath( target ) );
        } catch ( IOException ex ) {
            throw new UncheckedIOException( "Не удалось удалить объект " + key, ex );
        }
    }

    /**
     * Ключ приходит из приложения, но проверка всё равно нужна: путь с {@code ..} вывел бы
     * запись за пределы каталога хранилища.
     */
    private Path resolve( String key ) {
        Path target = root.resolve( key ).normalize();
        if ( !target.startsWith( root ) ) {
            throw new IllegalArgumentException( "Недопустимый ключ объекта: " + key );
        }
        return target;
    }

    private Path contentTypePath( Path target ) {
        return target.resolveSibling( target.getFileName() + ".type" );
    }
}
