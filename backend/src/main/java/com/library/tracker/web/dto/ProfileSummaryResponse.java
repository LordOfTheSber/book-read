package com.library.tracker.web.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Value;

/**
 * Пользователь в списке: в подписках, в авторе события ленты, в комментарии. Ни роли, ни блокировки,
 * ни настроек сессии — всё это администраторские сведения, и в социальном слое им делать нечего.
 */
@Value
@Builder
public class ProfileSummaryResponse {

    UUID id;
    String username;
    String displayName;
    boolean hasAvatar;
    boolean publicProfile;
    /** Подписан ли спрашивающий на этого человека. */
    boolean followedByMe;
}
