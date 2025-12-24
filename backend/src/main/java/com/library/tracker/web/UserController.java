package com.library.tracker.web;

import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.UserResponse;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
