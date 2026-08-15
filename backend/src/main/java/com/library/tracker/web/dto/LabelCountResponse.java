package com.library.tracker.web.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Разбивка по признаку без собственной сущности — язык издания, десятилетие выхода. У таких
 * срезов нет идентификатора, по которому можно перейти, поэтому и в ответе его нет.
 */
@Value
@Builder
public class LabelCountResponse {

    String label;
    long count;
}
