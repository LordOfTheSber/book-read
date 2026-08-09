package com.library.tracker.domain;

/**
 * Каталог достижений. Условие живёт не здесь, а в сервисе — там оно проверяется исчерпывающим
 * {@code switch} по этому перечислению, и компилятор не даст завести достижение, которое никогда
 * не выдаётся. В БД от достижения остаётся только код и дата выдачи.
 */
public enum Achievement {

    FIRST_ITEM( "Начало положено", "Первое завершённое произведение" ),
    TEN_ITEMS( "Десяток", "Десять завершённых произведений" ),
    FIFTY_ITEMS( "Полсотни", "Пятьдесят завершённых произведений" ),
    HUNDRED_ITEMS( "Сотня", "Сто завершённых произведений" ),
    WEEK_STREAK( "Неделя подряд", "Семь дней чтения без перерыва" ),
    MONTH_STREAK( "Месяц подряд", "Тридцать дней чтения без перерыва" ),
    REVIEWER( "Рецензент", "Десять написанных отзывов" ),
    QUOTE_KEEPER( "Собиратель", "Пятьдесят выписок" ),
    POLYGLOT( "Полиглот", "Произведения на трёх языках" ),
    OMNIVORE( "Всеядный", "Пять разных видов произведений" ),
    GOAL_KEEPER( "Цель взята", "Выполненная цель года" );

    private final String title;
    private final String description;

    Achievement( String title, String description ) {
        this.title = title;
        this.description = description;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }
}
