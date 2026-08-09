package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/** Месяц года и сколько в нём дочитано. Месяцы отдаются все двенадцать, включая пустые. */
@Value
@Builder
public class MonthCountResponse {

    int month;
    long count;
}
