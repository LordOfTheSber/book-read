package com.library.tracker.web.dto;

import com.library.tracker.domain.Role;

import jakarta.validation.constraints.NotNull;

import lombok.Data;

@Data
public class UpdateUserRoleRequest {

    @NotNull
    private Role role;
}
