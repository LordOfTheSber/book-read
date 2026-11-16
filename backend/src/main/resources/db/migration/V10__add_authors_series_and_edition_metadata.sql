-- Раздел 1 части II роадмепа: карточка произведения обрастает автором, серией,
-- издательскими метаданными, обложкой, форматом экземпляра и расположением.

CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    alt_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Автор ищется и создаётся по имени без учёта регистра, поэтому уникальность тоже без него.
CREATE UNIQUE INDEX uq_authors_name_lower ON authors (LOWER(name));

CREATE TABLE series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_series_name_lower ON series (LOWER(name));

CREATE TABLE library_item_authors (
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, author_id)
);

CREATE INDEX idx_library_item_authors_author ON library_item_authors (author_id);

ALTER TABLE library_items
    ADD COLUMN series_id UUID REFERENCES series(id),
    -- Дробный номер нужен для побочных повестей: 2.5 в цикле — обычное дело.
    ADD COLUMN order_in_series NUMERIC(6,2),
    ADD COLUMN isbn VARCHAR(20),
    ADD COLUMN published_year INTEGER,
    ADD COLUMN language VARCHAR(32),
    ADD COLUMN page_count INTEGER,
    ADD COLUMN translator VARCHAR(255),
    -- Ключ объекта в хранилище: сам файл в БД не лежит, в отличие от аватаров.
    ADD COLUMN cover_key VARCHAR(255),
    ADD COLUMN cover_content_type VARCHAR(100),
    ADD COLUMN format VARCHAR(32),
    ADD COLUMN bookcase VARCHAR(255),
    ADD COLUMN shelf VARCHAR(255);

CREATE INDEX idx_items_series ON library_items (series_id);
CREATE INDEX idx_items_isbn ON library_items (isbn);
CREATE INDEX idx_items_published_year ON library_items (published_year);
