package com.library.tracker.storage;

/** Содержимое объекта вместе с типом: хранилище отдаёт то, что нужно отправить клиенту. */
public record StoredObject( byte[] content, String contentType ) { }
