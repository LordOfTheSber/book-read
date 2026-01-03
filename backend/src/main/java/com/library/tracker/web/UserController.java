package com.library.tracker.web;

import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.UserSessionSettingsRequest;
import com.library.tracker.web.dto.UserResponse;

import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;

@RestController
@RequestMapping( "/api/v1/users" )
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public List<UserResponse> listUsers() {
        return userService.findAll();
    }

    @GetMapping( "/me" )
    public UserResponse me() {
        return userService.getCurrentUserProfile();
    }

    @PutMapping( value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE )
    public UserResponse updateAvatar( @RequestParam( "file" ) MultipartFile file ) {
        return userService.updateCurrentUserAvatar( file );
    }

    @GetMapping( "/{id}/avatar" )
    public ResponseEntity<byte[]> getAvatar( @PathVariable UUID id ) {
        return userService.findById( id )
                          .filter( user -> user.getAvatar() != null )
                          .map( user -> ResponseEntity.ok()
                                                       .header( HttpHeaders.CONTENT_TYPE, user.getAvatarContentType() )
                                                       .body( userService.decompressAvatar( user.getAvatar() ) ) )
                          .orElse( ResponseEntity.notFound().build() );
    }

    @PutMapping( "/{id}/session-settings" )
    public UserResponse updateSessionSettings(
            @PathVariable UUID id,
            @Valid @RequestBody UserSessionSettingsRequest request
                                             ) {
        return userService.updateSessionOverrides( id,
                                                   request.getSessionTtlMinutes(),
                                                   request.getMaxSessionLifetimeMinutes() );
    }

    @DeleteMapping( "/{id}/session-settings" )
    public UserResponse clearSessionSettings( @PathVariable UUID id ) {
        return userService.clearSessionOverrides( id );
    }
}
