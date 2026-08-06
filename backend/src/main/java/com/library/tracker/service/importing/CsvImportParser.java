package com.library.tracker.service.importing;

import com.library.tracker.domain.MediaKind;
import com.library.tracker.domain.ReadingStatus;
import com.library.tracker.web.dto.LibraryImportRow;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Разбор пользовательской выгрузки из Goodreads, StoryGraph или LiveLib.
 * <p>
 * Колонки у всех трёх называются по-разному, поэтому заголовок сводится к набору известных
 * синонимов, а не к позиции: в выгрузке Goodreads два десятка столбцов, и порядок их меняется
 * от версии к версии.
 */
@Component
public class CsvImportParser {

    /** Больше двух тысяч строк за раз — это уже перенос базы, а не импорт списка. */
    public static final int MAX_ROWS = 2000;

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern( "yyyy/MM/dd" ),
            DateTimeFormatter.ofPattern( "yyyy-MM-dd" ),
            DateTimeFormatter.ofPattern( "dd.MM.yyyy" ),
            DateTimeFormatter.ofPattern( "dd/MM/yyyy" ) );

    /**
     * Полки Goodreads и StoryGraph, которые задают статус, а не пометку: попадать в теги
     * им незачем — статус для них уже разобран.
     */
    private static final Set<String> STATUS_SHELVES =
            Set.of( "read", "currently-reading", "to-read", "currently reading", "to read", "did-not-finish",
                    "did not finish", "dnf" );

    private static final Map<String, ReadingStatus> STATUSES = Map.ofEntries(
            Map.entry( "read", ReadingStatus.COMPLETED ),
            Map.entry( "прочитано", ReadingStatus.COMPLETED ),
            Map.entry( "прочитана", ReadingStatus.COMPLETED ),
            Map.entry( "currently-reading", ReadingStatus.READING ),
            Map.entry( "currently reading", ReadingStatus.READING ),
            Map.entry( "reading", ReadingStatus.READING ),
            Map.entry( "читаю", ReadingStatus.READING ),
            Map.entry( "to-read", ReadingStatus.PLANNED ),
            Map.entry( "to read", ReadingStatus.PLANNED ),
            Map.entry( "хочу прочитать", ReadingStatus.PLANNED ),
            Map.entry( "планирую", ReadingStatus.PLANNED ),
            Map.entry( "on-hold", ReadingStatus.ON_HOLD ),
            Map.entry( "paused", ReadingStatus.ON_HOLD ),
            Map.entry( "отложено", ReadingStatus.ON_HOLD ),
            Map.entry( "dnf", ReadingStatus.DROPPED ),
            Map.entry( "did-not-finish", ReadingStatus.DROPPED ),
            Map.entry( "did not finish", ReadingStatus.DROPPED ),
            Map.entry( "не дочитал", ReadingStatus.DROPPED ),
            Map.entry( "брошено", ReadingStatus.DROPPED ) );

    private static final List<String> TITLE_KEYS = List.of( "title", "название", "книга", "book", "bookname" );
    private static final List<String> AUTHOR_KEYS =
            List.of( "author", "authors", "автор", "авторы", "primaryauthor" );
    private static final List<String> EXTRA_AUTHOR_KEYS = List.of( "additionalauthors", "contributors" );
    private static final List<String> ISBN_KEYS = List.of( "isbn13", "isbn", "исбн" );
    private static final List<String> YEAR_KEYS =
            List.of( "originalpublicationyear", "yearpublished", "год", "годиздания", "publishedyear",
                     "publicationyear" );
    private static final List<String> PAGES_KEYS = List.of( "numberofpages", "pages", "pagecount", "страниц" );
    private static final List<String> RATING_KEYS = List.of( "myrating", "starrating", "rating", "мояоценка", "оценка" );
    private static final List<String> STATUS_KEYS =
            List.of( "exclusiveshelf", "readstatus", "status", "статус", "состояние" );
    private static final List<String> FINISHED_KEYS =
            List.of( "dateread", "lastdateread", "датапрочтения", "дата прочтения", "прочитано" );
    private static final List<String> STARTED_KEYS =
            List.of( "datestarted", "началочтения", "дата начала", "dateadded" );
    private static final List<String> REVIEW_KEYS = List.of( "myreview", "review", "рецензия", "отзыв" );
    private static final List<String> NOTE_KEYS = List.of( "privatenotes", "notes", "заметка", "комментарий" );
    private static final List<String> SERIES_KEYS = List.of( "series", "серия", "цикл" );
    private static final List<String> TAG_KEYS = List.of( "bookshelves", "tags", "теги", "метки" );

    public Parsed parse( InputStream input, String fileName ) throws IOException {
        try ( BufferedReader reader = new BufferedReader( new InputStreamReader( input, StandardCharsets.UTF_8 ) ) ) {
            CSVFormat format = CSVFormat.Builder.create( CSVFormat.DEFAULT )
                                                .setDelimiter( separator( reader ) )
                                                .setHeader()
                                                .setSkipHeaderRecord( true )
                                                .setIgnoreSurroundingSpaces( true )
                                                .setIgnoreEmptyLines( true )
                                                .setTrim( true )
                                                .build();

            try ( CSVParser parser = format.parse( reader ) ) {
                Map<String, Integer> headers = normalizedHeaders( parser.getHeaderMap() );
                String source = detectSource( headers.keySet() );
                List<LibraryImportRow> rows = new ArrayList<>();

                for ( CSVRecord record : parser ) {
                    if ( rows.size() >= MAX_ROWS ) {
                        break;
                    }
                    rows.add( toRow( record, headers, source ) );
                }
                return new Parsed( fileName, source, rows );
            }
        }
    }

    /**
     * LiveLib отдаёт файл с точкой с запятой, Goodreads — с запятой. Разделитель определяется
     * по строке заголовка: перепутанный превращает всю таблицу в одну колонку.
     */
    private char separator( BufferedReader reader ) throws IOException {
        reader.mark( 8192 );
        String header = reader.readLine();
        reader.reset();
        if ( header == null ) {
            return ',';
        }
        return header.chars().filter( c -> c == ';' ).count() > header.chars().filter( c -> c == ',' ).count()
                ? ';'
                : ',';
    }

    private Map<String, Integer> normalizedHeaders( Map<String, Integer> headerMap ) {
        Map<String, Integer> normalized = new java.util.LinkedHashMap<>();
        headerMap.forEach( ( name, index ) -> normalized.put( normalizeKey( name ), index ) );
        return normalized;
    }

    /** «Exclusive Shelf», «exclusive_shelf» и «ExclusiveShelf» — одно и то же имя колонки. */
    private String normalizeKey( String name ) {
        return name == null ? "" : name.toLowerCase( Locale.ROOT ).replaceAll( "[^a-zа-я0-9]", "" );
    }

    private String detectSource( Set<String> headers ) {
        if ( headers.contains( "exclusiveshelf" ) || headers.contains( "bookid" ) ) {
            return "GOODREADS";
        }
        if ( headers.contains( "readstatus" ) || headers.contains( "starrating" ) ) {
            return "STORYGRAPH";
        }
        if ( headers.contains( "название" ) || headers.contains( "автор" ) ) {
            return "LIVELIB";
        }
        return "GENERIC";
    }

    private LibraryImportRow toRow( CSVRecord record, Map<String, Integer> headers, String source ) {
        String title = value( record, headers, TITLE_KEYS );
        LibraryImportRow row = LibraryImportRow.builder()
                                               .line( (int) record.getRecordNumber() + 1 )
                                               .title( title )
                                               .authorNames( authors( record, headers ) )
                                               .isbn( isbn( value( record, headers, ISBN_KEYS ) ) )
                                               .publishedYear( integer( value( record, headers, YEAR_KEYS ) ) )
                                               .pageCount( integer( value( record, headers, PAGES_KEYS ) ) )
                                               .seriesName( value( record, headers, SERIES_KEYS ) )
                                               .rating( rating( value( record, headers, RATING_KEYS ), source ) )
                                               .status( status( record, headers ) )
                                               .kind( MediaKind.BOOK )
                                               .startedAt( date( value( record, headers, STARTED_KEYS ) ) )
                                               .finishedAt( date( value( record, headers, FINISHED_KEYS ) ) )
                                               .review( value( record, headers, REVIEW_KEYS ) )
                                               .note( value( record, headers, NOTE_KEYS ) )
                                               .tagNames( tags( record, headers ) )
                                               .errors( new ArrayList<>() )
                                               .duplicates( new ArrayList<>() )
                                               .build();

        if ( !StringUtils.hasText( title ) ) {
            row.getErrors().add( "Строка без названия — заводить нечего" );
        }
        return row;
    }

    private List<String> authors( CSVRecord record, Map<String, Integer> headers ) {
        Set<String> names = new LinkedHashSet<>();
        addSplit( names, value( record, headers, AUTHOR_KEYS ) );
        addSplit( names, value( record, headers, EXTRA_AUTHOR_KEYS ) );
        return new ArrayList<>( names );
    }

    private List<String> tags( CSVRecord record, Map<String, Integer> headers ) {
        Set<String> names = new LinkedHashSet<>();
        addSplit( names, value( record, headers, TAG_KEYS ) );
        // Полка, задающая статус, тегом быть не должна: «read» рядом с «на лето» выглядит мусором.
        names.removeIf( name -> STATUS_SHELVES.contains( name.toLowerCase( Locale.ROOT ) ) );
        return new ArrayList<>( names );
    }

    private void addSplit( Set<String> target, String raw ) {
        if ( !StringUtils.hasText( raw ) ) {
            return;
        }
        Arrays.stream( raw.split( "[,;]" ) )
              .map( String::trim )
              .filter( StringUtils::hasText )
              .forEach( target::add );
    }

    private ReadingStatus status( CSVRecord record, Map<String, Integer> headers ) {
        String raw = value( record, headers, STATUS_KEYS );
        if ( !StringUtils.hasText( raw ) ) {
            return null;
        }
        return STATUSES.get( raw.trim().toLowerCase( Locale.ROOT ) );
    }

    /**
     * Goodreads, StoryGraph и LiveLib оценивают по пяти звёздам, у нас шкала до десяти:
     * четыре звезды — это восемь, а не четыре. Незнакомый источник переносится как есть.
     */
    private BigDecimal rating( String raw, String source ) {
        if ( !StringUtils.hasText( raw ) ) {
            return null;
        }
        BigDecimal parsed;
        try {
            parsed = new BigDecimal( raw.trim().replace( ',', '.' ) );
        } catch ( NumberFormatException ex ) {
            return null;
        }
        if ( parsed.signum() <= 0 ) {
            return null;
        }
        BigDecimal scaled = "GENERIC".equals( source ) ? parsed : parsed.multiply( BigDecimal.valueOf( 2 ) );
        BigDecimal clamped = scaled.min( BigDecimal.TEN ).max( BigDecimal.ZERO );
        return clamped.setScale( 1, RoundingMode.HALF_UP );
    }

    /** Goodreads пишет ISBN как {@code ="9785171049676"}, чтобы Excel не съел ведущий ноль. */
    private String isbn( String raw ) {
        if ( !StringUtils.hasText( raw ) ) {
            return null;
        }
        String cleaned = raw.replace( "=", "" ).replace( "\"", "" ).trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private Integer integer( String raw ) {
        if ( !StringUtils.hasText( raw ) ) {
            return null;
        }
        try {
            int parsed = Integer.parseInt( raw.trim() );
            return parsed > 0 ? parsed : null;
        } catch ( NumberFormatException ex ) {
            return null;
        }
    }

    private LocalDate date( String raw ) {
        if ( !StringUtils.hasText( raw ) ) {
            return null;
        }
        for ( DateTimeFormatter formatter : DATE_FORMATS ) {
            try {
                return LocalDate.parse( raw.trim(), formatter );
            } catch ( Exception ignored ) {
                // Формат не подошёл — пробуем следующий; неразобранная дата не повод терять строку.
            }
        }
        return null;
    }

    private String value( CSVRecord record, Map<String, Integer> headers, List<String> keys ) {
        for ( String key : keys ) {
            Integer index = headers.get( key );
            if ( index != null && index < record.size() ) {
                String value = record.get( index );
                if ( StringUtils.hasText( value ) ) {
                    return value.trim();
                }
            }
        }
        return null;
    }

    public record Parsed( String fileName, String source, List<LibraryImportRow> rows ) { }
}
