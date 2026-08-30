package com.library.tracker.service.importing;

import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.web.dto.LibraryImportRow;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Разбор чужих выгрузок. Проверяется именно то, чем они отличаются друг от друга: имена колонок,
 * разделитель, шкала оценки и оформление ISBN — из-за любого из этих различий импорт молча
 * превращается в мусор.
 */
class CsvImportParserTest {

    private final CsvImportParser parser = new CsvImportParser();

    @Test
    void readsGoodreadsExport() throws Exception {
        // Обычная строка, а не текстовый блок: Goodreads экранирует кавычки удвоением,
        // и три кавычки подряд закрыли бы блок посреди данных.
        String csv = "Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Number of Pages,"
                     + "Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,"
                     + "Exclusive Shelf,My Review\n"
                     + "7113,\"Задача трёх тел\",\"Лю Цысинь\",\"Ken Liu\",\"=\"\"0439023483\"\"\","
                     + "\"=\"\"9785171049676\"\"\",4,400,2014,2006,2024/03/15,2024/01/02,"
                     + "\"на лето, sci-fi\",read,\"Отличная книга, местами затянуто\"\n";

        CsvImportParser.Parsed parsed = parse( csv, "goodreads_library_export.csv" );

        assertThat( parsed.source() ).isEqualTo( "GOODREADS" );
        assertThat( parsed.rows() ).hasSize( 1 );

        LibraryImportRow row = parsed.rows().get( 0 );
        assertThat( row.getTitle() ).isEqualTo( "Задача трёх тел" );
        assertThat( row.getAuthorNames() ).containsExactly( "Лю Цысинь", "Ken Liu" );
        // ISBN13 приоритетнее десятизначного, а обёртку ="…" Goodreads ставит ради Excel.
        assertThat( row.getIsbn() ).isEqualTo( "9785171049676" );
        assertThat( row.getPublishedYear() ).isEqualTo( 2006 );
        assertThat( row.getPageCount() ).isEqualTo( 400 );
        // Четыре звезды из пяти — это восемь из десяти, а не четыре.
        assertThat( row.getRating() ).isEqualByComparingTo( "8.0" );
        assertThat( row.getStatus() ).isEqualTo( ReadingStatus.COMPLETED );
        assertThat( row.getFinishedAt() ).isEqualTo( LocalDate.of( 2024, 3, 15 ) );
        // Полка, задающая статус, тегом быть не должна.
        assertThat( row.getTagNames() ).containsExactly( "на лето", "sci-fi" );
        assertThat( row.getReview() ).isEqualTo( "Отличная книга, местами затянуто" );
        assertThat( row.getErrors() ).isEmpty();
    }

    @Test
    void readsStoryGraphExport() throws Exception {
        String csv = """
                Title,Authors,ISBN/UID,Read Status,Star Rating,Last Date Read
                Piranesi,Susanna Clarke,9781526622426,currently reading,,
                """;

        CsvImportParser.Parsed parsed = parse( csv, "storygraph.csv" );

        assertThat( parsed.source() ).isEqualTo( "STORYGRAPH" );
        LibraryImportRow row = parsed.rows().get( 0 );
        assertThat( row.getTitle() ).isEqualTo( "Piranesi" );
        assertThat( row.getStatus() ).isEqualTo( ReadingStatus.READING );
        // Пустая оценка — это отсутствие оценки, а не ноль.
        assertThat( row.getRating() ).isNull();
    }

    /** LiveLib отдаёт файл с точкой с запятой: с запятой вся таблица схлопнулась бы в одну колонку. */
    @Test
    void readsSemicolonSeparatedRussianExport() throws Exception {
        String csv = """
                Название;Автор;Оценка;Статус;Дата прочтения
                Град обреченный;Аркадий Стругацкий;5;прочитано;12.04.2023
                """;

        CsvImportParser.Parsed parsed = parse( csv, "livelib.csv" );

        assertThat( parsed.source() ).isEqualTo( "LIVELIB" );
        LibraryImportRow row = parsed.rows().get( 0 );
        assertThat( row.getTitle() ).isEqualTo( "Град обреченный" );
        assertThat( row.getAuthorNames() ).containsExactly( "Аркадий Стругацкий" );
        assertThat( row.getRating() ).isEqualByComparingTo( "10.0" );
        assertThat( row.getStatus() ).isEqualTo( ReadingStatus.COMPLETED );
        assertThat( row.getFinishedAt() ).isEqualTo( LocalDate.of( 2023, 4, 12 ) );
    }

    /** Отзыв с переносом строки — обычное дело, и самописный split по строкам на нём разваливается. */
    @Test
    void keepsMultilineQuotedReviewInOneRow() throws Exception {
        String csv = "Title,My Review\nПиранези,\"Первая строка\nвторая строка\"\n";

        CsvImportParser.Parsed parsed = parse( csv, "review.csv" );

        assertThat( parsed.rows() ).hasSize( 1 );
        assertThat( parsed.rows().get( 0 ).getReview() ).isEqualTo( "Первая строка\nвторая строка" );
    }

    @Test
    void marksRowWithoutTitleAsUnusable() throws Exception {
        String csv = "Title,Author\n,Лю Цысинь\n";

        List<LibraryImportRow> rows = parse( csv, "broken.csv" ).rows();

        assertThat( rows ).hasSize( 1 );
        assertThat( rows.get( 0 ).getErrors() ).isNotEmpty();
    }

    /**
     * Колонки, которые не распознались, до этого пропадали молча: человек узнавал о потере,
     * не найдя в библиотеке своих заметок. Разбор обязан сказать, что он понял, а что нет.
     */
    @Test
    void reportsRecognizedAndUnknownColumnsWithSamples() throws Exception {
        String csv = "Title,Number of Pages,Owned Copies\nЗадача трёх тел,400,1\n";

        List<CsvImportParser.Column> columns = parse( csv, "goodreads.csv" ).columns();

        assertThat( columns ).extracting( CsvImportParser.Column::name )
                             .containsExactly( "Title", "Number of Pages", "Owned Copies" );
        assertThat( columns.get( 0 ).recognized() ).isTrue();
        assertThat( columns.get( 0 ).target() ).isEqualTo( "Название" );
        // Пример объясняет потерю лучше названия колонки: «1» рядом с «Owned Copies» — это данные.
        assertThat( columns.get( 2 ).recognized() ).isFalse();
        assertThat( columns.get( 2 ).target() ).isNull();
        assertThat( columns.get( 2 ).sample() ).isEqualTo( "1" );
    }

    private CsvImportParser.Parsed parse( String csv, String fileName ) throws Exception {
        return parser.parse( new ByteArrayInputStream( csv.getBytes( StandardCharsets.UTF_8 ) ), fileName );
    }
}
