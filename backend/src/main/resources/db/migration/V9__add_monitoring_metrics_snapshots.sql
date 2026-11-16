ALTER TABLE monitoring_settings
    ADD COLUMN ping_interval_seconds INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN ping_path TEXT NOT NULL DEFAULT '/api/v1/monitoring/ping';

CREATE TABLE monitoring_metrics_snapshots (
    node_key TEXT PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    total_requests BIGINT NOT NULL,
    error_requests BIGINT NOT NULL,
    average_duration_ms DOUBLE PRECISION NOT NULL,
    max_duration_ms BIGINT NOT NULL,
    last_request_at TIMESTAMPTZ,
    endpoints_json TEXT,
    slow_requests_json TEXT
);

CREATE INDEX idx_monitoring_metrics_snapshots_captured_at
    ON monitoring_metrics_snapshots (captured_at);
