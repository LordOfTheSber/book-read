-- Раздел 8 части II роадмепа: цели и вовлечение. Трекер отвечал на вопрос «что я прочитал»,
-- но не на «иду ли я по плану» — а именно второй заставляет открыть приложение сегодня.

-- Цель на год. Хранятся только цифры цели: прогресс считается по библиотеке и заходам, а не
-- накапливается в колонке, иначе удаление записи оставило бы счётчик завышенным навсегда.
CREATE TABLE reading_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INT NOT NULL,
    -- Цели необязательные и независимые: кто-то считает книгами, кто-то страницами, кто-то
    -- временем. Пустая цель просто не показывается.
    target_items INT,
    target_pages INT,
    target_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reading_goals_year CHECK (year BETWEEN 1970 AND 2200),
    CONSTRAINT chk_reading_goals_targets CHECK (
        (target_items IS NULL OR target_items > 0)
            AND (target_pages IS NULL OR target_pages > 0)
            AND (target_minutes IS NULL OR target_minutes > 0)
        )
);

CREATE UNIQUE INDEX uq_reading_goals_owner_year ON reading_goals (owner_id, year);

-- Достижения: список условий живёт в коде, в БД лежит только факт получения. Условие можно
-- переписать (порог, формулировку), и переносить его в строки значило бы чинить данные миграцией
-- при каждой правке. Дата выдачи фиксируется — задним числом достижение не переоткрывается.
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    unlocked_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_user_achievements_owner_code ON user_achievements (owner_id, code);

-- Стрик и «Год в обзоре» считаются по заходам: обоим нужен один и тот же срез «даты чтения
-- одного пользователя за период», а заходы до сих пор выбирались только по одной книге.
CREATE INDEX idx_reading_sessions_date ON reading_sessions (session_date);
-- Завершённые за год — второй столп годового отчёта и цели по книгам; индекс по finished_at
-- уже построен в V11 и здесь не дублируется.
