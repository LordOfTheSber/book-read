package com.library.tracker.web.dto;

import java.math.BigDecimal;
import java.util.Map;

import lombok.Builder;
import lombok.Value;

/**
 * Соотношение «куплено / прочитано». Купленным считается то, у чего проставлена цена: ссылка
 * на магазин без цены — это ещё намерение, а не покупка.
 * <p>
 * Потрачено отдаётся картой по валютам, а не одним числом: курса в трекере нет, и складывать
 * рубли с евро значило бы придумать его.
 */
@Value
@Builder
public class PurchaseStatsResponse {

    long purchased;
    long finishedOfPurchased;
    long unreadPurchased;
    Map<String, BigDecimal> spentByCurrency;
}
