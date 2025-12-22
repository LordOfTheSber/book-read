CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE book_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE library_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    alt_title VARCHAR(500),
    type_id UUID REFERENCES book_types(id),
    comment TEXT,
    rating NUMERIC(3,1),
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_title ON library_items(title);
CREATE INDEX idx_items_alt_title ON library_items(alt_title);
CREATE INDEX idx_items_status ON library_items(status);
CREATE INDEX idx_items_favorite ON library_items(favorite);
CREATE INDEX idx_items_type ON library_items(type_id);
CREATE INDEX idx_items_updated ON library_items(updated_at);