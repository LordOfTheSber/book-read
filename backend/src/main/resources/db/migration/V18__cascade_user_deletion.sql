-- Каскады под удаление аккаунта.
--
-- На пользователя ссылаются полтора десятка таблиц, и почти все заведены с ON DELETE CASCADE.
-- Две — нет: library_items.created_by из V3 и sessions.user_id из V6 появились раньше, чем
-- удаление пользователя стало возможным сценарием, и до сих пор DELETE FROM users падал
-- на нарушении внешнего ключа.
--
-- Каскад здесь — не способ удалять записи (сервис всё равно проходит по ним сам, чтобы вычистить
-- обложки из объектного хранилища), а страховка: без него частичный сбой оставил бы висеть
-- библиотеку без владельца, а сессии — без пользователя, то есть живые ключи к несуществующему
-- аккаунту.
--
-- Имена ограничений PostgreSQL генерирует по шаблону «таблица_колонка_fkey»; в V3 и V6 они
-- заданы неявно, поэтому здесь используется тот же шаблон.
ALTER TABLE library_items DROP CONSTRAINT library_items_created_by_fkey;
ALTER TABLE library_items
    ADD CONSTRAINT library_items_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE sessions DROP CONSTRAINT sessions_user_id_fkey;
ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
