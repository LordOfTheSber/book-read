CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE library_items
    ADD COLUMN source_id UUID REFERENCES sources(id);

CREATE INDEX idx_sources_name ON sources(name);
CREATE INDEX idx_items_source ON library_items(source_id);
