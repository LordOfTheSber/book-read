package com.library.tracker.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.Getter;
import lombok.Setter;

@Entity
@Table( name = "system_nodes", uniqueConstraints = @UniqueConstraint( columnNames = "node_key" ) )
@Getter
@Setter
public class SystemNode extends BaseAuditEntity {

    @Id
    @GeneratedValue( strategy = GenerationType.AUTO )
    private UUID id;

    @Column( name = "node_key", nullable = false )
    private String nodeKey;

    @Column( name = "hostname" )
    private String hostname;

    @Column( name = "ip" )
    private String ip;

    @Column( name = "port" )
    private Integer port;

    @Column( name = "cpu_load" )
    private Double cpuLoad;

    @Column( name = "system_memory_total" )
    private Long systemMemoryTotal;

    @Column( name = "system_memory_free" )
    private Long systemMemoryFree;

    @Column( name = "heap_used" )
    private Long heapUsed;

    @Column( name = "heap_committed" )
    private Long heapCommitted;

    @Column( name = "heap_max" )
    private Long heapMax;

    @Column( name = "disk_total" )
    private Long diskTotal;

    @Column( name = "disk_free" )
    private Long diskFree;

    @Column( name = "uptime_seconds" )
    private Long uptimeSeconds;

    @Column( name = "last_reported_at" )
    private LocalDateTime lastReportedAt;
}
