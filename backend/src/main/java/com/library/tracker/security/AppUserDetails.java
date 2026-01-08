package com.library.tracker.security;

import com.library.tracker.domain.Role;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
@Builder
public class AppUserDetails implements UserDetails {

    private final UUID id;
    private final String username;
    private final String password;
    private final Role role;
    private final boolean blocked;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of( new SimpleGrantedAuthority( "ROLE_" + role.name() ) );
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !blocked;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return !blocked;
    }
}
