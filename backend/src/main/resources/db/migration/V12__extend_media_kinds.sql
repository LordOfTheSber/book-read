-- Раздел 3 части II роадмепа: MediaKind был enum с единственным значением BOOK —
-- мультимедийность лежала в схеме, но не была раскрыта.
--
-- Столбец kind уже VARCHAR, поэтому новые значения не требуют изменения типа. Миграция
-- фиксирует переход: она проставляет единицу прогресса тем записям, где её ещё нет, чтобы
-- у сериалов и манги счёт шёл в эпизодах и томах, а не в страницах.

UPDATE library_items
SET progress_unit = CASE
                        WHEN format = 'AUDIO' THEN 'MINUTES'
                        ELSE 'PAGES'
                    END
WHERE progress_unit IS NULL
  AND (page_count IS NOT NULL OR progress_total IS NOT NULL);

-- Раньше вид произведения был один и фильтровать по нему было незачем.
CREATE INDEX idx_items_kind ON library_items (kind);
