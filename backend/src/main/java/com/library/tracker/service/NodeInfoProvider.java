package com.library.tracker.service;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.RuntimeMXBean;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.file.FileStore;
import java.nio.file.FileSystems;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class NodeInfoProvider {

    @Value( "${node.id:${NODE_ID:}}" )
    private String configuredNodeId;

    @Value( "${server.port:8080}" )
    private int serverPort;

    public NodeSnapshot captureSnapshot() {
        Runtime runtime = Runtime.getRuntime();
        MemoryMXBean memoryMXBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heap = memoryMXBean.getHeapMemoryUsage();
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        RuntimeMXBean runtimeMXBean = ManagementFactory.getRuntimeMXBean();

        String hostname = resolveHostName();
        String ip = resolveHostIp();
        String nodeKey = resolveNodeKey( hostname );

        long diskTotal = 0L;
        long diskFree = 0L;
        try {
            for ( FileStore store : FileSystems.getDefault().getFileStores() ) {
                diskTotal += safeTotalSpace( store );
                diskFree += safeUsableSpace( store );
            }
        } catch ( Exception ignored ) {
            // ignore file store errors, leave zeros
        }

        Double cpuLoad = null;
        Long totalPhysical = null;
        Long freePhysical = null;
        if ( osBean instanceof com.sun.management.OperatingSystemMXBean advancedOsBean ) {
            cpuLoad = normalizeCpuLoad( advancedOsBean.getCpuLoad() );
            totalPhysical = normalizeLong( advancedOsBean.getTotalMemorySize() );
            freePhysical = normalizeLong( advancedOsBean.getFreeMemorySize() );
        } else {
            cpuLoad = normalizeCpuLoad( osBean.getSystemLoadAverage() );
            totalPhysical = normalizeLong( runtime.maxMemory() );
            freePhysical = normalizeLong( runtime.freeMemory() );
        }

        return new NodeSnapshot(
                nodeKey,
                hostname,
                ip,
                serverPort,
                cpuLoad,
                totalPhysical,
                freePhysical,
                heap.getUsed(),
                heap.getCommitted(),
                normalizeLong( heap.getMax() ),
                normalizeLong( diskTotal ),
                normalizeLong( diskFree ),
                runtimeMXBean.getUptime() / 1000,
                LocalDateTime.now( ZoneId.systemDefault() )
        );
    }

    /** Ключ узла без сбора остальной телеметрии: нужен как метка метрик Micrometer. */
    public String nodeKey() {
        return resolveNodeKey( resolveHostName() );
    }

    private String resolveNodeKey( String fallbackHost ) {
        if ( StringUtils.hasText( configuredNodeId ) ) {
            return configuredNodeId;
        }
        String portSuffix = serverPort > 0 ? ":" + serverPort : "";
        return fallbackHost + portSuffix;
    }

    private String resolveHostName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch ( UnknownHostException e ) {
            return "unknown-host";
        }
    }

    private String resolveHostIp() {
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch ( UnknownHostException e ) {
            return null;
        }
    }

    private long safeTotalSpace( FileStore store ) throws IOException {
        return store.getTotalSpace();
    }

    private long safeUsableSpace( FileStore store ) throws IOException {
        return store.getUsableSpace();
    }

    private Long normalizeLong( long value ) {
        return value >= 0 ? value : null;
    }

    private Double normalizeCpuLoad( Double value ) {
        if ( value == null || value.isNaN() || value < 0 ) {
            return null;
        }
        return value;
    }
}
