CREATE TABLE monitoring_settings (
    id BIGINT PRIMARY KEY,
    metrics_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO monitoring_settings (id, metrics_enabled)
VALUES (1, TRUE);
