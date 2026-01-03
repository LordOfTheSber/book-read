package com.library.tracker.web;

import com.library.tracker.service.SessionService;
import com.library.tracker.web.dto.SessionSettingsRequest;
import com.library.tracker.web.dto.SessionSettingsResponse;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/sessions/settings" )
@RequiredArgsConstructor
public class SessionSettingsController {

    private final SessionService sessionService;

    @GetMapping
    public SessionSettingsResponse getSettings() {
        return sessionService.getGlobalSettings();
    }

    @PutMapping
    public SessionSettingsResponse updateSettings( @Valid @RequestBody SessionSettingsRequest request ) {
        return sessionService.updateGlobalSettings( request.getSessionTtlMinutes(),
                                                    request.getMaxSessionLifetimeMinutes() );
    }
}
