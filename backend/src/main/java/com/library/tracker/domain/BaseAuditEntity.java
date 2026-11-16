package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Getter
@MappedSuperclass
@EntityListeners( AuditingEntityListener.class )
public abstract class BaseAuditEntity {

    @CreatedDate
    @Column( name = "created_at", nullable = false, updatable = false )
    protected LocalDateTime createdAt;

    @LastModifiedDate
    @Column( name = "updated_at", nullable = false )
    protected LocalDateTime updatedAt;

    public void setCreatedAt( LocalDateTime createdAt ) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt( LocalDateTime updatedAt ) {
        this.updatedAt = updatedAt;
    }
}
