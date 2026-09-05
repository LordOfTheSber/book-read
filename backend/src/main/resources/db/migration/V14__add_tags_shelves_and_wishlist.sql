-- Раздел 6 части II роадмепа: организация библиотеки. Тип (`book_types`) — это жанр из общего
-- справочника; всё остальное, чем пользователь режет свою библиотеку, было ему недоступно.

-- Теги свободные и личные: «на лето» у одного и «на лето» у другого — разные пометки,
-- поэтому уникальность в пределах владельца, а не по всей базе.
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    -- Цвет чипа в интерфейсе; null — нейтральный.
    color VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Тег заводится по имени без учёта регистра — так же, как автор и серия.
CREATE UNIQUE INDEX uq_tags_owner_name_lower ON tags (owner_id, LOWER(name));

CREATE TABLE library_item_tags (
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX idx_library_item_tags_tag ON library_item_tags (tag_id);

-- Полка (коллекция) — именованный набор с описанием. В отличие от умной полки состав задаётся
-- вручную: «подарить», «книжный клуб, весна».
CREATE TABLE shelves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    -- Публичная полка видна другим пользователям сервиса по прямой ссылке.
    -- Анонимный доступ намеренно не открывается: см. оговорку про социальный слой в роадмепе.
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_shelves_owner_name_lower ON shelves (owner_id, LOWER(name));

CREATE TABLE shelf_items (
    shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    PRIMARY KEY (shelf_id, item_id)
);

CREATE INDEX idx_shelf_items_item ON shelf_items (item_id);

-- Умная полка — сохранённый фильтр, а не набор записей: состав пересчитывается при каждом открытии.
-- Параметры лежат объектом, потому что список фильтров растёт, и колонка на каждый быстро протухла бы.
CREATE TABLE smart_shelves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_smart_shelves_owner_name_lower ON smart_shelves (owner_id, LOWER(name));

-- Список желаемого отдельно от статуса «в планах»: «планирую прочитать» и «надо купить» —
-- разные вопросы, и смешивать их в одном статусе значит терять оба.
ALTER TABLE library_items
    ADD COLUMN wishlist BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN price NUMERIC(12,2),
    ADD COLUMN currency VARCHAR(8),
    ADD COLUMN purchase_url VARCHAR(2048);

CREATE INDEX idx_items_wishlist ON library_items (wishlist) WHERE wishlist;

-- Полнотекстовый поиск: запрос шёл `LIKE '%…%'` по двум полям и не мог опереться ни на один индекс.
-- pg_trgm (расширение уже включено в V11) делает такой LIKE индексируемым, а поиск расширяется
-- на автора, теги и выписки.
CREATE INDEX idx_items_title_trgm ON library_items USING gin (LOWER(title) gin_trgm_ops);
CREATE INDEX idx_items_alt_title_trgm ON library_items USING gin (LOWER(alt_title) gin_trgm_ops);
CREATE INDEX idx_authors_name_trgm ON authors USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_tags_name_trgm ON tags USING gin (LOWER(name) gin_trgm_ops);
-- Дубли ищутся по ISBN без разделителей, поэтому индекс тоже по нормализованному значению.
CREATE INDEX idx_items_isbn_normalized ON library_items (REPLACE(REPLACE(isbn, '-', ''), ' ', ''));
