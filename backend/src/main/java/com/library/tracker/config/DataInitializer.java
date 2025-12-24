package com.library.tracker.config;

import com.library.tracker.domain.Role;
import com.library.tracker.service.UserService;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserService userService;

    @Override
    public void run( String... args ) {
        userService.ensureUser( "admin", "admin123", Role.ADMIN );
        userService.ensureUser( "editor", "editor123", Role.EDITOR );
        userService.ensureUser( "user", "user123", Role.USER );
    }
}
