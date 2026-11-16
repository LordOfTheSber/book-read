ALTER TABLE users
    ADD COLUMN avatar BYTEA,
    ADD COLUMN avatar_content_type VARCHAR(100);
