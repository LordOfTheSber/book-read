package com.library.tracker.service;

import com.library.tracker.web.dto.NovelChapterResponse;
import com.library.tracker.web.dto.NovelChapterResponse.ChapterInfo;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class NovelParserService {

    private static final Pattern FANFICTION_URL_PATTERN =
            Pattern.compile( "https?://(?:www\\.)?fanfiction\\.net/s/(\\d+)/(\\d+)(?:/(.*))?$" );

    public NovelChapterResponse parseChapter( String url ) throws IOException {
        validateUrl( url );

        Document doc = Jsoup.connect( url )
                            .userAgent( "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" )
                            .timeout( 15_000 )
                            .get();

        Matcher matcher = FANFICTION_URL_PATTERN.matcher( url );
        if ( matcher.matches() ) {
            return parseFanfictionNet( doc, url, matcher.group( 1 ), Integer.parseInt( matcher.group( 2 ) ) );
        }

        return parseGeneric( doc, url );
    }

    private void validateUrl( String url ) {
        try {
            URI uri = URI.create( url );
            String host = uri.getHost();
            if ( host == null ) {
                throw new IllegalArgumentException( "Некорректный URL" );
            }
        } catch ( Exception e ) {
            throw new IllegalArgumentException( "Некорректный URL: " + e.getMessage() );
        }
    }

    private NovelChapterResponse parseFanfictionNet( Document doc, String url, String storyId, int currentChapter ) {
        Element profileTop = doc.getElementById( "profile_top" );
        String title = "";
        String author = "";
        String description = "";

        if ( profileTop != null ) {
            Element titleEl = profileTop.selectFirst( "b.xcontrast_txt" );
            if ( titleEl != null ) {
                title = titleEl.text();
            }

            Element authorEl = profileTop.selectFirst( "a.xcontrast_txt[href^=/u/]" );
            if ( authorEl != null ) {
                author = authorEl.text();
            }

            Elements descDivs = profileTop.select( "div.xcontrast_txt" );
            for ( Element div : descDivs ) {
                String text = div.text().trim();
                if ( !text.isEmpty() && text.length() > 20 ) {
                    description = text;
                    break;
                }
            }
        }

        Element storyText = doc.getElementById( "storytext" );
        String textHtml = storyText != null ? storyText.html() : "";

        List<ChapterInfo> chapters = new ArrayList<>();
        Elements chapterOptions = doc.select( "select#chap_select option" );
        // Only process the first select (there are two duplicates on the page)
        int totalChapters = 1;
        if ( !chapterOptions.isEmpty() ) {
            int halfSize = chapterOptions.size() / 2;
            int limit = halfSize > 0 ? halfSize : chapterOptions.size();
            for ( int i = 0; i < limit; i++ ) {
                Element option = chapterOptions.get( i );
                int chapterNum = Integer.parseInt( option.attr( "value" ) );
                String chapterUrl = "https://www.fanfiction.net/s/" + storyId + "/" + chapterNum + "/";
                chapters.add( ChapterInfo.builder()
                                         .number( chapterNum )
                                         .title( option.text() )
                                         .url( chapterUrl )
                                         .build() );
            }
            totalChapters = limit;
        }

        String chapterTitle = "";
        for ( ChapterInfo ch : chapters ) {
            if ( ch.getNumber() == currentChapter ) {
                chapterTitle = ch.getTitle();
                break;
            }
        }

        String nextChapterUrl = null;
        String prevChapterUrl = null;
        if ( currentChapter < totalChapters ) {
            nextChapterUrl = "https://www.fanfiction.net/s/" + storyId + "/" + ( currentChapter + 1 ) + "/";
        }
        if ( currentChapter > 1 ) {
            prevChapterUrl = "https://www.fanfiction.net/s/" + storyId + "/" + ( currentChapter - 1 ) + "/";
        }

        return NovelChapterResponse.builder()
                                   .title( title )
                                   .author( author )
                                   .description( description )
                                   .chapterTitle( chapterTitle )
                                   .currentChapter( currentChapter )
                                   .totalChapters( totalChapters )
                                   .chapters( chapters )
                                   .textHtml( textHtml )
                                   .nextChapterUrl( nextChapterUrl )
                                   .prevChapterUrl( prevChapterUrl )
                                   .build();
    }

    private NovelChapterResponse parseGeneric( Document doc, String url ) {
        String title = doc.title();

        Element article = doc.selectFirst( "article" );
        if ( article == null ) {
            article = doc.selectFirst( "main" );
        }
        if ( article == null ) {
            article = doc.body();
        }

        String textHtml = article != null ? article.html() : "";

        return NovelChapterResponse.builder()
                                   .title( title )
                                   .author( "" )
                                   .description( "" )
                                   .chapterTitle( title )
                                   .currentChapter( 1 )
                                   .totalChapters( 1 )
                                   .chapters( List.of( ChapterInfo.builder()
                                                                  .number( 1 )
                                                                  .title( title )
                                                                  .url( url )
                                                                  .build() ) )
                                   .textHtml( textHtml )
                                   .nextChapterUrl( null )
                                   .prevChapterUrl( null )
                                   .build();
    }
}
