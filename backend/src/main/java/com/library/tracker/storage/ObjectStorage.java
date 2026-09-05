package com.library.tracker.storage;

import java.util.Optional;

/**
 * Хранилище бинарных объектов — сейчас это обложки. Аватары лежат в БД, и повторять этот путь
 * не хочется: обложки крупнее, их больше, и каждая выборка произведения тянула бы их за собой.
 * <p>
 * Реализаций две: файловая (по умолчанию, ничего не требует) и S3-совместимая (для продакшена).
 */
public interface ObjectStorage {

    /** Кладёт объект под ключом; существующий по тому же ключу заменяется. */
    void put( String key, byte[] content, String contentType );

    Optional<StoredObject> get( String key );

    /** Удаление несуществующего ключа не считается ошибкой. */
    void delete( String key );
}
