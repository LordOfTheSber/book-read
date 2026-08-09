package com.library.tracker.web.dto;

import java.util.List;

import lombok.Builder;
import lombok.Value;

/**
 * Аналитика во времени — всё, чего нет в {@link BookAnalyticsResponse}. Разделены они не по теме,
 * а по цене: сводка висит в шапке списка книг и профиля, и дописывать в неё тепловую карту
 * с прогнозами значило бы платить за них при каждом открытии библиотеки.
 * <p>
 * Сравнение с прошлым годом — это два {@link PeriodStatsResponse}, а не отдельный тип с дельтами:
 * клиент рисует обе цифры рядом, и считать разницу на сервере незачем.
 */
@Value
@Builder
public class ReadingAnalyticsResponse {

    List<PeriodStatsResponse> byMonth;
    List<PeriodStatsResponse> byYear;
    List<DayActivityResponse> heatmap;
    ReadingPaceResponse pace;
    List<FinishForecastResponse> forecasts;
    List<AuthorCountResponse> byAuthor;
    List<LabelCountResponse> byLanguage;
    List<LabelCountResponse> byDecade;
    PurchaseStatsResponse purchases;
    PeriodStatsResponse currentYear;
    PeriodStatsResponse previousYear;
}
