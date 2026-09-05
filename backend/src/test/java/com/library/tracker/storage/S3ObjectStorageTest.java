package com.library.tracker.storage;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Проверяются вызовы, которые адаптер делает к S3: бакет, ключ, тип содержимого и то, что
 * отсутствующий объект превращается в пустой {@link Optional}, а не в исключение.
 * Настоящее S3-хранилище здесь не поднимается — за протокол отвечает AWS SDK.
 */
@ExtendWith( MockitoExtension.class )
class S3ObjectStorageTest {

    private static final String BUCKET = "book-read-covers";

    @Mock
    private S3Client client;

    private S3ObjectStorage storage;

    @BeforeEach
    void setUp() {
        storage = new S3ObjectStorage( BUCKET, client );
    }

    @Test
    void putSendsKeyBucketAndContentType() {
        storage.put( "covers/one", "картинка".getBytes( StandardCharsets.UTF_8 ), "image/png" );

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass( PutObjectRequest.class );
        verify( client ).putObject( request.capture(), any( RequestBody.class ) );
        assertThat( request.getValue().bucket() ).isEqualTo( BUCKET );
        assertThat( request.getValue().key() ).isEqualTo( "covers/one" );
        assertThat( request.getValue().contentType() ).isEqualTo( "image/png" );
    }

    @Test
    void getReturnsContentWithTypeFromResponse() {
        byte[] content = "картинка".getBytes( StandardCharsets.UTF_8 );
        when( client.getObjectAsBytes( any( GetObjectRequest.class ) ) )
                .thenReturn( ResponseBytes.fromByteArray(
                        GetObjectResponse.builder().contentType( "image/webp" ).build(), content ) );

        StoredObject stored = storage.get( "covers/one" ).orElseThrow();

        assertThat( stored.content() ).isEqualTo( content );
        assertThat( stored.contentType() ).isEqualTo( "image/webp" );
    }

    /** Отсутствие объекта — обычный случай, а не сбой: карточка просто без обложки. */
    @Test
    void getReturnsEmptyWhenKeyIsMissing() {
        when( client.getObjectAsBytes( any( GetObjectRequest.class ) ) )
                .thenThrow( NoSuchKeyException.builder().message( "not found" ).build() );

        assertThat( storage.get( "covers/missing" ) ).isEmpty();
    }

    @Test
    void deleteAddressesTheSameBucketAndKey() {
        storage.delete( "covers/one" );

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass( DeleteObjectRequest.class );
        verify( client ).deleteObject( request.capture() );
        assertThat( request.getValue().bucket() ).isEqualTo( BUCKET );
        assertThat( request.getValue().key() ).isEqualTo( "covers/one" );
    }
}
