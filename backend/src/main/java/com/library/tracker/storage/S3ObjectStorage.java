package com.library.tracker.storage;

import java.net.URI;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * S3-совместимое хранилище обложек: AWS S3, MinIO, Ceph — что угодно с тем же API.
 * Включается через {@code storage.type=s3}.
 * <p>
 * {@code storage.s3.endpoint} задаётся для не-амазоновских реализаций; вместе с ним обычно нужен
 * и {@code path-style-access}, потому что виртуальный хостинг бакетов у них чаще всего не поднят.
 */
@Component
@ConditionalOnProperty( name = "storage.type", havingValue = "s3" )
@Slf4j
public class S3ObjectStorage implements ObjectStorage {

    private final S3Client client;
    private final String bucket;

    public S3ObjectStorage(
            @Value( "${storage.s3.bucket}" ) String bucket,
            @Value( "${storage.s3.region:us-east-1}" ) String region,
            @Value( "${storage.s3.endpoint:}" ) String endpoint,
            @Value( "${storage.s3.access-key:}" ) String accessKey,
            @Value( "${storage.s3.secret-key:}" ) String secretKey,
            @Value( "${storage.s3.path-style-access:true}" ) boolean pathStyleAccess ) {
        this( bucket, buildClient( region, endpoint, accessKey, secretKey, pathStyleAccess ) );
    }

    /** Для тестов: клиент подставляется готовым. */
    S3ObjectStorage( String bucket, S3Client client ) {
        this.bucket = bucket;
        this.client = client;
        log.info( "Обложки хранятся в S3-совместимом бакете {}", bucket );
    }

    private static S3Client buildClient( String region, String endpoint, String accessKey, String secretKey,
                                         boolean pathStyleAccess ) {
        S3ClientBuilder builder = S3Client.builder()
                                          .region( Region.of( region ) )
                                          .httpClient( UrlConnectionHttpClient.create() )
                                          .forcePathStyle( pathStyleAccess );
        if ( StringUtils.hasText( endpoint ) ) {
            builder.endpointOverride( URI.create( endpoint ) );
        }
        // Ключи в окружении необязательны: в облаке роль машины даёт их сама.
        builder.credentialsProvider( StringUtils.hasText( accessKey ) && StringUtils.hasText( secretKey )
                ? StaticCredentialsProvider.create( AwsBasicCredentials.create( accessKey, secretKey ) )
                : DefaultCredentialsProvider.create() );
        return builder.build();
    }

    @Override
    public void put( String key, byte[] content, String contentType ) {
        client.putObject( PutObjectRequest.builder()
                                          .bucket( bucket )
                                          .key( key )
                                          .contentType( contentType )
                                          .build(),
                          RequestBody.fromBytes( content ) );
    }

    @Override
    public Optional<StoredObject> get( String key ) {
        try {
            ResponseBytes<GetObjectResponse> object =
                    client.getObjectAsBytes( GetObjectRequest.builder().bucket( bucket ).key( key ).build() );
            return Optional.of( new StoredObject( object.asByteArray(), object.response().contentType() ) );
        } catch ( NoSuchKeyException ex ) {
            return Optional.empty();
        }
    }

    @Override
    public void delete( String key ) {
        // S3 сам считает удаление отсутствующего ключа успешным, поэтому проверок не нужно.
        client.deleteObject( DeleteObjectRequest.builder().bucket( bucket ).key( key ).build() );
    }
}
