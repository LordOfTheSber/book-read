-- Раздел 4 части II роадмепа: приватная заметка и публичный отзыв были одним полем comment,
-- оценка — одним числом, а история оценок при перечитывании не сохранялась.

ALTER TABLE library_items
    -- Приватная заметка: «на чём остановился», «купить второй том».
    ADD COLUMN note TEXT,
    -- Публичный отзыв: то, что имеет смысл показывать другим.
    ADD COLUMN review TEXT,
    -- Спойлерная часть отзыва отдельным полем: так её можно спрятать под кат, не разбирая разметку.
    ADD COLUMN review_spoiler TEXT,
    ADD COLUMN rating_plot NUMERIC(3,1),
    ADD COLUMN rating_style NUMERIC(3,1),
    ADD COLUMN rating_characters NUMERIC(3,1),
    ADD COLUMN rating_ending NUMERIC(3,1);

-- Существующий comment всегда писался «для себя», поэтому переезжает в приватную заметку:
-- опубликовать чужой текст задним числом было бы хуже, чем оставить его закрытым.
UPDATE library_items SET note = comment WHERE comment IS NOT NULL;

ALTER TABLE library_items DROP COLUMN comment;

-- История оценок при перечитывании: у каждого прохода свои критерии.
ALTER TABLE reading_logs
    ADD COLUMN rating_plot NUMERIC(3,1),
    ADD COLUMN rating_style NUMERIC(3,1),
    ADD COLUMN rating_characters NUMERIC(3,1),
    ADD COLUMN rating_ending NUMERIC(3,1);
