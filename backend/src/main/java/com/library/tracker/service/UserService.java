package com.library.tracker.service;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.security.AppUserDetails;
import com.library.tracker.web.dto.UserResponse;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional( readOnly = true )
    public UserDetails loadUserByUsername( String username ) throws UsernameNotFoundException {
        User user = userRepository.findByUsernameIgnoreCase( username )
                                  .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
        return toUserDetails( user );
    }

    @Transactional( readOnly = true )
    public Optional<User> findByUsername( String username ) {
        return userRepository.findByUsernameIgnoreCase( username );
    }

    @Transactional( readOnly = true )
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                             .stream()
                             .map( this::toResponse )
                             .toList();
    }

    public User ensureUser( String username, String rawPassword, Role role ) {
        return userRepository.findByUsernameIgnoreCase( username )
                             .orElseGet( () -> {
                                 User user = new User();
                                 user.setUsername( username );
                                 user.setPassword( passwordEncoder.encode( rawPassword ) );
                                 user.setRole( role );
                                 return userRepository.save( user );
                             } );
    }

    public User register( String username, String rawPassword ) {
        if ( userRepository.existsByUsernameIgnoreCase( username ) ) {
            throw new IllegalArgumentException( "Username already exists" );
        }
        User user = new User();
        user.setUsername( username );
        user.setPassword( passwordEncoder.encode( rawPassword ) );
        user.setRole( Role.USER );
        return userRepository.save( user );
    }

    @Transactional( readOnly = true )
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if ( authentication == null || !authentication.isAuthenticated()
             || authentication.getPrincipal() instanceof String )
        {
            throw new AccessDeniedException( "User is not authenticated" );
        }
        String username = authentication.getName();
        return userRepository.findByUsernameIgnoreCase( username )
                             .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
    }

    @Transactional( readOnly = true )
    public UserResponse getCurrentUserProfile() {
        return toResponse( getCurrentUser() );
    }

    public boolean isAdmin( User user ) {
        return user.getRole() == Role.ADMIN;
    }

    public UserResponse toResponse( User user ) {
        return UserResponse.builder()
                           .id( user.getId() )
                           .username( user.getUsername() )
                           .role( user.getRole() )
                           .createdAt( toOffsetDateTime( user.getCreatedAt() ) )
                           .updatedAt( toOffsetDateTime( user.getUpdatedAt() ) )
                           .build();
    }

    private AppUserDetails toUserDetails( User user ) {
        return AppUserDetails.builder()
                             .id( user.getId() )
                             .username( user.getUsername() )
                             .password( user.getPassword() )
                             .role( user.getRole() )
                             .build();
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }
}
