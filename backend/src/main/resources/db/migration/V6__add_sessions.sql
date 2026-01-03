CREATE TABLE session_settings (
    id BIGINT PRIMARY KEY,
    session_ttl_minutes INTEGER NOT NULL,
    max_session_lifetime_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO session_settings (id, session_ttl_minutes, max_session_lifetime_minutes)
VALUES (1, 30, 1440);

ALTER TABLE users
    ADD COLUMN session_ttl_override_minutes INTEGER,
    ADD COLUMN max_session_lifetime_override_minutes INTEGER;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    max_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
