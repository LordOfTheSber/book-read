package com.library.tracker.service;

import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.SessionRepository;
import com.library.tracker.repository.UserRepository;
import com.library.tracker.security.AppUserDetails;
import com.library.tracker.web.dto.UserResponse;

import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import net.jpountz.lz4.LZ4Factory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final LZ4Factory lz4Factory = LZ4Factory.fastestInstance();
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "image/gif"
    );

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
        String normalizedUsername = normalizeUsername( username );
        return userRepository.findByUsernameIgnoreCase( normalizedUsername )
                             .orElseGet( () -> {
                                 User user = new User();
                                 user.setUsername( normalizedUsername );
                                 user.setPassword( passwordEncoder.encode( rawPassword ) );
                                 user.setRole( role );
                                 user.setBlocked( false );
                                 return userRepository.save( user );
                             } );
    }

    public User register( String username, String rawPassword ) {
        String normalizedUsername = normalizeUsername( username );
        if ( !StringUtils.hasText( normalizedUsername ) ) {
            throw new IllegalArgumentException( "Username cannot be blank" );
        }
        if ( userRepository.existsByUsernameIgnoreCase( normalizedUsername ) ) {
            throw new IllegalArgumentException( "Username already exists" );
        }
        User user = new User();
        user.setUsername( normalizedUsername );
        user.setPassword( passwordEncoder.encode( rawPassword ) );
        user.setRole( userRepository.count() == 0 ? Role.SUPER_ADMIN : Role.USER );
        user.setBlocked( false );
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

    public UserResponse updateCurrentUserAvatar( MultipartFile file ) {
        if ( file.isEmpty() ) {
            throw new IllegalArgumentException( "Avatar file is empty" );
        }
        if ( file.getSize() > 2 * 1024 * 1024 ) {
            throw new IllegalArgumentException( "Avatar must be less than 2MB" );
        }
        String contentType = file.getContentType();
        if ( contentType == null || !ALLOWED_CONTENT_TYPES.contains( contentType.toLowerCase() ) ) {
            throw new IllegalArgumentException( "Unsupported avatar format. Allowed: PNG, JPEG, WEBP, GIF" );
        }

        User user = getCurrentUser();
        try {
            byte[] compressedAvatar = compressAvatar( file.getBytes() );
            user.setAvatar( compressedAvatar );
            user.setAvatarContentType( contentType );
            User saved = userRepository.save( user );
            return toResponse( saved );
        } catch ( Exception ex ) {
            throw new IllegalArgumentException( "Failed to save avatar" );
        }
    }

    public Optional<User> findById( UUID id ) {
        return userRepository.findById( id );
    }

    public boolean isAdmin( User user ) {
        return user.getRole() == Role.ADMIN || user.getRole() == Role.SUPER_ADMIN;
    }

    public boolean isSuperAdmin( User user ) {
        return user.getRole() == Role.SUPER_ADMIN;
    }

    public UserResponse updateSessionOverrides( UUID userId, Integer ttlMinutes, Integer maxLifetimeMinutes ) {
        User user = userRepository.findById( userId )
                                  .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
        if ( ttlMinutes != null && ttlMinutes < 1 ) {
            throw new IllegalArgumentException( "Session TTL must be at least 1 minute" );
        }
        if ( maxLifetimeMinutes != null && maxLifetimeMinutes < 1 ) {
            throw new IllegalArgumentException( "Max session lifetime must be at least 1 minute" );
        }
        if ( ttlMinutes != null && maxLifetimeMinutes != null && maxLifetimeMinutes < ttlMinutes ) {
            throw new IllegalArgumentException( "Max session lifetime cannot be shorter than TTL" );
        }
        user.setSessionTtlOverrideMinutes( ttlMinutes );
        user.setMaxSessionLifetimeOverrideMinutes( maxLifetimeMinutes );
        User saved = userRepository.save( user );
        return toResponse( saved );
    }

    public UserResponse clearSessionOverrides( UUID userId ) {
        User user = userRepository.findById( userId )
                                  .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
        user.setSessionTtlOverrideMinutes( null );
        user.setMaxSessionLifetimeOverrideMinutes( null );
        User saved = userRepository.save( user );
        return toResponse( saved );
    }

    public UserResponse updateRole( UUID userId, Role role ) {
        if ( role == null ) {
            throw new IllegalArgumentException( "Role is required" );
        }
        User currentUser = getCurrentUser();
        if ( !isSuperAdmin( currentUser ) ) {
            throw new AccessDeniedException( "Only super admins can update roles" );
        }
        User user = userRepository.findById( userId )
                                  .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
        if ( user.getRole() == Role.SUPER_ADMIN && role != Role.SUPER_ADMIN ) {
            ensureAnotherSuperAdminExists( user.getId() );
        }
        user.setRole( role );
        User saved = userRepository.save( user );
        return toResponse( saved );
    }

    public UserResponse updateBlockedStatus( UUID userId, boolean blocked ) {
        User currentUser = getCurrentUser();
        if ( !isSuperAdmin( currentUser ) ) {
            throw new AccessDeniedException( "Only super admins can block users" );
        }
        if ( userId.equals( currentUser.getId() ) && blocked ) {
            throw new IllegalStateException( "Нельзя заблокировать самого себя" );
        }
        User user = userRepository.findById( userId )
                                  .orElseThrow( () -> new UsernameNotFoundException( "User not found" ) );
        if ( blocked && user.getRole() == Role.SUPER_ADMIN ) {
            ensureAnotherSuperAdminExists( user.getId() );
        }
        user.setBlocked( blocked );
        User saved = userRepository.save( user );
        if ( blocked ) {
            sessionRepository.deleteAllByUserId( userId );
        }
        return toResponse( saved );
    }

    public UserResponse toResponse( User user ) {
        return UserResponse.builder()
                           .id( user.getId() )
                           .username( user.getUsername() )
                           .role( user.getRole() )
                           .avatar( encodeAvatar( decompressAvatar( user.getAvatar() ) ) )
                           .avatarContentType( user.getAvatarContentType() )
                           .createdAt( toOffsetDateTime( user.getCreatedAt() ) )
                           .updatedAt( toOffsetDateTime( user.getUpdatedAt() ) )
                           .sessionTtlOverrideMinutes( user.getSessionTtlOverrideMinutes() )
                           .maxSessionLifetimeOverrideMinutes( user.getMaxSessionLifetimeOverrideMinutes() )
                           .blocked( user.isBlocked() )
                           .build();
    }

    private AppUserDetails toUserDetails( User user ) {
        return AppUserDetails.builder()
                             .id( user.getId() )
                             .username( user.getUsername() )
                             .password( user.getPassword() )
                             .role( user.getRole() )
                             .blocked( user.isBlocked() )
                             .build();
    }

    private void ensureAnotherSuperAdminExists( UUID excludedUserId ) {
        long superAdmins = userRepository.countByRole( Role.SUPER_ADMIN );
        if ( superAdmins <= 1 && excludedUserId != null ) {
            throw new IllegalStateException( "Должен остаться хотя бы один супер админ" );
        }
    }

    private String normalizeUsername( String username ) {
        return username != null ? username.trim() : "";
    }

    private OffsetDateTime toOffsetDateTime( LocalDateTime dateTime ) {
        return dateTime != null ? dateTime.atOffset( ZoneOffset.UTC ) : null;
    }

    private String encodeAvatar( byte[] avatar ) {
        return avatar != null ? Base64.getEncoder().encodeToString( avatar ) : null;
    }

    private byte[] compressAvatar( byte[] avatar ) {
        if ( avatar == null || avatar.length == 0 ) {
            return avatar;
        }
        var compressor = lz4Factory.fastCompressor();
        int maxCompressedLength = compressor.maxCompressedLength( avatar.length );
        byte[] target = new byte[4 + maxCompressedLength];
        ByteBuffer.wrap( target ).putInt( avatar.length );
        int compressedSize = compressor.compress( avatar, 0, avatar.length, target, 4, maxCompressedLength );
        return Arrays.copyOf( target, 4 + compressedSize );
    }

    public byte[] decompressAvatar( byte[] avatar ) {
        if ( avatar == null || avatar.length < 4 ) {
            return avatar;
        }
        try {
            ByteBuffer buffer = ByteBuffer.wrap( avatar );
            int originalSize = buffer.getInt();
            if ( originalSize <= 0 ) {
                return avatar;
            }
            var decompressor = lz4Factory.fastDecompressor();
            byte[] result = new byte[originalSize];
            decompressor.decompress( avatar, 4, result, 0, originalSize );
            return result;
        } catch ( Exception ex ) {
            return avatar;
        }
    }
}
