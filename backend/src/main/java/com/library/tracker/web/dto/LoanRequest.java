package com.library.tracker.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

import lombok.Data;

@Data
public class LoanRequest {

    @NotBlank( message = "Не указано, кому выдана книга" )
    @Size( max = 128, message = "Имя не длиннее 128 символов" )
    private String borrowerName;

    @Size( max = 255, message = "Контакт не длиннее 255 символов" )
    private String borrowerContact;

    /** Пусто — значит сегодня: чаще всего запись заводят в момент выдачи. */
    private LocalDate lentOn;

    private LocalDate dueOn;

    @Size( max = 2000, message = "Заметка не длиннее 2000 символов" )
    private String note;
}
