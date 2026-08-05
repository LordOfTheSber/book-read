-- Раздел 2 части II роадмепа: статус переключался мгновенно и бесследно — нельзя было ответить,
-- когда произведение завершено и сколько времени заняло.

ALTER TABLE library_items
    ADD COLUMN started_at DATE,
    ADD COLUMN finished_at DATE,
    -- «Дочитать к дате»: по нему считается норма в день и отставание.
    ADD COLUMN deadline DATE,
    -- Прогресс отделён от числа страниц издания: у аудио это минуты, у сериала — эпизоды.
    ADD COLUMN progress_current INTEGER,
    ADD COLUMN progress_total INTEGER,
    ADD COLUMN progress_unit VARCHAR(32);

CREATE INDEX idx_items_finished_at ON library_items (finished_at);
CREATE INDEX idx_items_deadline ON library_items (deadline);

-- Проход по произведению. Перечитывание — это новая попытка, а не перезапись единственного статуса.
CREATE TABLE reading_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL,
    started_at DATE,
    finished_at DATE,
    rating NUMERIC(3,1),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reading_logs_item_attempt UNIQUE (item_id, attempt)
);

CREATE INDEX idx_reading_logs_item ON reading_logs (item_id);

CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    -- Сессия привязывается к проходу, чтобы история перечитываний не смешивалась.
    log_id UUID REFERENCES reading_logs(id) ON DELETE SET NULL,
    session_date DATE NOT NULL,
    from_position INTEGER,
    to_position INTEGER,
    duration_minutes INTEGER,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reading_sessions_item_date ON reading_sessions (item_id, session_date DESC);

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    position INTEGER,
    text TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_item ON quotes (item_id);
-- Поиск по выпискам идёт по подстроке без учёта регистра; pg_trgm делает такой LIKE индексируемым.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_quotes_text_trgm ON quotes USING gin (LOWER(text) gin_trgm_ops);
