package com.library.tracker.web.dto;

import java.time.LocalDate;
import java.util.UUID;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LoanResponse {

    UUID id;
    UUID itemId;
    String itemTitle;
    String borrowerName;
    String borrowerContact;
    LocalDate lentOn;
    LocalDate dueOn;
    LocalDate returnedOn;
    String note;
    /** Считается на чтении, а не хранится: колонка требовала бы пересчёта каждую полночь. */
    boolean overdue;
    long daysOut;
}
