CREATE TABLE system_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key VARCHAR(255) NOT NULL UNIQUE,
    hostname VARCHAR(255),
    ip VARCHAR(255),
    port INTEGER,
    cpu_load DOUBLE PRECISION,
    system_memory_total BIGINT,
    system_memory_free BIGINT,
    heap_used BIGINT,
    heap_committed BIGINT,
    heap_max BIGINT,
    disk_total BIGINT,
    disk_free BIGINT,
    uptime_seconds BIGINT,
    last_reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_nodes_last_reported ON system_nodes(last_reported_at);
