-- Раздел 7 части II роадмепа: социальный слой. До сих пор всё, что заводил пользователь, видел
-- только он сам (плюс публичная полка по прямой ссылке из раздела 6). Здесь появляется адресуемая
-- страница человека, подписки, лента и обсуждение отзывов.
--
-- Оговорка в конце роадмепа остаётся в силе: ни одна из точек ниже не открывается анонимному
-- запросу. «Публичный» здесь означает «видимый другим пользователям сервиса», а не всему интернету.

-- Профиль: имя для показа и описание отдельно от логина. Логин участвует в адресе /u/username
-- и в аутентификации, поэтому менять его ради красивой подписи нельзя.
ALTER TABLE users
    ADD COLUMN display_name VARCHAR(128),
    ADD COLUMN bio TEXT,
    -- Профиль закрыт по умолчанию: включение делится данными, и это должно быть решением
    -- пользователя, а не следствием обновления.
    ADD COLUMN public_profile BOOLEAN NOT NULL DEFAULT FALSE;

-- Подписки односторонние, как чтение блога: подтверждения нет, потому что подписаться можно
-- только на открытый профиль, и владелец уже согласился показывать его.
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Подписка на себя ничего не добавляет: своя активность в ленте и так есть.
    CONSTRAINT chk_user_follows_not_self CHECK (follower_id <> followee_id)
);

CREATE UNIQUE INDEX uq_user_follows_pair ON user_follows (follower_id, followee_id);
CREATE INDEX idx_user_follows_followee ON user_follows (followee_id);

-- Лента пишется событиями, а не собирается запросом по текущему состоянию библиотеки: запись
-- «дочитал» должна остаться в ленте, даже если книгу потом перевели в «читаю» или переоценили.
-- Событие хранит и снимок подписи — переименованная полка не переписывает задним числом историю.
CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    item_id UUID REFERENCES library_items(id) ON DELETE CASCADE,
    shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE,
    subject VARCHAR(512),
    detail VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Лента читается «последние события этих людей»: индекс по автору и времени в одном порядке.
CREATE INDEX idx_activity_actor_created ON activity_events (actor_id, created_at DESC);

-- Реакция одна от человека на отзыв: смена «палец вверх» на «в закладки» — это правка строки,
-- а не вторая реакция. Иначе счётчики пришлось бы чистить от накрутки в самом очевидном месте.
CREATE TABLE review_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_review_reactions_item_user ON review_reactions (item_id, user_id);
CREATE INDEX idx_review_reactions_item ON review_reactions (item_id);

CREATE TABLE review_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_comments_item_created ON review_comments (item_id, created_at);

-- Совместные полки: семейная полка и книжный клуб. Роли здесь свои, внутри полки, — глобальная
-- роль отвечает на другой вопрос («что человеку можно в сервисе»), и смешивать их нельзя:
-- участник клуба не становится администратором сервиса, а администратор — участником каждой полки.
CREATE TABLE shelf_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- VIEWER читает, CONTRIBUTOR добавляет и снимает свои записи, CURATOR правит состав целиком.
    role VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_shelf_members_pair ON shelf_members (shelf_id, user_id);
CREATE INDEX idx_shelf_members_user ON shelf_members (user_id);

-- Кому отдана книга. Заёмщик — просто имя, а не пользователь сервиса: книги чаще отдают коллегам
-- и родственникам, которых здесь нет, и требовать регистрации ради записи «у Ани с марта» незачем.
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    borrower_name VARCHAR(128) NOT NULL,
    borrower_contact VARCHAR(255),
    lent_on DATE NOT NULL,
    due_on DATE,
    returned_on DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_loans_returned_after_lent CHECK (returned_on IS NULL OR returned_on >= lent_on)
);

CREATE INDEX idx_loans_item ON loans (item_id);
-- Напоминание «пора вернуть» ходит только по невозвращённым, поэтому индекс частичный.
CREATE INDEX idx_loans_open_due ON loans (due_on) WHERE returned_on IS NULL;
