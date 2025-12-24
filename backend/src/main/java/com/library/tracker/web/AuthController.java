package com.library.tracker.web;

import com.library.tracker.domain.User;
import com.library.tracker.security.JwtService;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.AuthRequest;
import com.library.tracker.web.dto.AuthResponse;
import com.library.tracker.web.dto.RegisterRequest;
import com.library.tracker.web.dto.UserResponse;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping( "/api/v1/auth" )
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;

    @PostMapping( "/login" )
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequest request
                                             ) {
        UsernamePasswordAuthenticationToken token =
                new UsernamePasswordAuthenticationToken( request.getUsername(), request.getPassword() );
        Authentication authentication = authenticationManager.authenticate( token );

        User user = userService.findByUsername( authentication.getName() )
                               .orElseThrow( () -> new IllegalStateException( "User not found after login" ) );
        UserResponse userResponse = userService.toResponse( user );
        String jwt = jwtService.generateToken( user );
        AuthResponse response = AuthResponse.builder()
                                            .token( jwt )
                                            .user( userResponse )
                                            .build();
        return ResponseEntity.ok( response );
    }

    @PostMapping( "/register" )
    public ResponseEntity<AuthResponse> register( @Valid @RequestBody RegisterRequest request ) {
        User user = userService.register( request.getUsername(), request.getPassword() );
        String token = jwtService.generateToken( user );
        UserResponse userResponse = userService.toResponse( user );
        return ResponseEntity.ok( AuthResponse.builder().token( token ).user( userResponse ).build() );
    }
}
