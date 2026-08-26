-- Быстрый вход: устройство, которому пользователь однажды доверился, входит без пароля.
--
-- Секрет устройства в базе не лежит: хранится SHA-256 от него, как и в случае с паролем, —
-- утечка таблицы не даёт ключей ко входу. Отпечаток железа хранится тем же способом: он не
-- секрет, но и восстанавливать из базы список машин пользователя незачем.
--
-- Отпечаток здесь второй фактор к куке, а не замена ей: браузер не выдаёт ничего, что
-- однозначно опознавало бы машину, поэтому совпадение отпечатка лишь подтверждает, что кукой
-- пользуются с того же устройства, где её выдали.
CREATE TABLE trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    fingerprint_hash VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    last_ip VARCHAR(45),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Повторный вход с того же устройства обновляет запись, а не заводит вторую: иначе список
-- «мои устройства» за месяц зарастал бы десятком одинаковых строк про один и тот же браузер.
CREATE UNIQUE INDEX idx_trusted_devices_user_fingerprint ON trusted_devices(user_id, fingerprint_hash);
CREATE INDEX idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_expires_at ON trusted_devices(expires_at);
