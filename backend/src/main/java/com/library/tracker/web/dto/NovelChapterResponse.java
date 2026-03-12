package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class NovelChapterResponse {

    String title;
    String author;
    String description;
    String chapterTitle;
    int currentChapter;
    int totalChapters;
    List<ChapterInfo> chapters;
    String textHtml;
    String nextChapterUrl;
    String prevChapterUrl;

    @Value
    @Builder
    public static class ChapterInfo {
        int number;
        String title;
        String url;
    }
}
