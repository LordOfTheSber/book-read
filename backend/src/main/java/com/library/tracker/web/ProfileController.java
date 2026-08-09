package com.library.tracker.web;

import com.library.tracker.service.social.ActivityService;
import com.library.tracker.service.social.ProfileService;
import com.library.tracker.web.dto.ActivityResponse;
import com.library.tracker.web.dto.ProfileSummaryResponse;
import com.library.tracker.web.dto.ProfileUpdateRequest;
import com.library.tracker.web.dto.PublicProfileResponse;
import jakarta.validation.Valid;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Публичные профили и подписки. Закрытый профиль отдаётся как отсутствующий: 404 вместо 403 не
 * подтверждает существование логина тому, кому его не показывают.
 */
@RestController
@RequestMapping( "/api/v1/profiles" )
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final ActivityService activityService;

    @GetMapping( "/me" )
    public PublicProfileResponse me() {
        return profileService.me();
    }

    @PutMapping( "/me" )
    public PublicProfileResponse updateMe( @Valid @RequestBody ProfileUpdateRequest request ) {
        return profileService.updateMyProfile( request );
    }

    /** Поиск людей, на кого можно подписаться: только открытые профили. */
    @GetMapping( "/search" )
    public List<ProfileSummaryResponse> search( @RequestParam( value = "query", required = false ) String query ) {
        return profileService.search( query );
    }

    @GetMapping( "/{username}" )
    public ResponseEntity<PublicProfileResponse> getByUsername( @PathVariable String username ) {
        return profileService.findByUsername( username )
                             .map( ResponseEntity::ok )
                             .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @GetMapping( "/{username}/activity" )
    public ResponseEntity<List<ActivityResponse>> activity( @PathVariable String username,
                                                            @RequestParam( required = false ) Integer limit ) {
        return profileService.activity( username, limit )
                             .map( ResponseEntity::ok )
                             .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @GetMapping( "/{username}/followers" )
    public ResponseEntity<List<ProfileSummaryResponse>> followers( @PathVariable String username ) {
        return profileService.followers( username )
                             .map( ResponseEntity::ok )
                             .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @GetMapping( "/{username}/following" )
    public ResponseEntity<List<ProfileSummaryResponse>> following( @PathVariable String username ) {
        return profileService.following( username )
                             .map( ResponseEntity::ok )
                             .orElseGet( () -> ResponseEntity.notFound().build() );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PostMapping( "/{username}/follow" )
    public PublicProfileResponse follow( @PathVariable String username ) {
        return profileService.follow( username );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/{username}/follow" )
    public PublicProfileResponse unfollow( @PathVariable String username ) {
        return profileService.unfollow( username );
    }

    /** Лента подписок вместе со своими событиями. */
    @GetMapping( "/me/feed" )
    public List<ActivityResponse> feed( @RequestParam( required = false ) Integer limit ) {
        return activityService.feed( limit );
    }
}
