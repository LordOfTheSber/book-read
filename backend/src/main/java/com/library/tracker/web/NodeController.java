package com.library.tracker.web;

import com.library.tracker.service.NodeService;
import com.library.tracker.web.dto.NodeMemoryDetailResponse;
import com.library.tracker.web.dto.NodeStatusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping( "/api/v1/nodes" )
@RequiredArgsConstructor
@Slf4j
public class NodeController {

    private final NodeService nodeService;

    @Value( "${logging.file.path:logs}" )
    private String logsPath;

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @GetMapping
    public List<NodeStatusResponse> listNodes() {
        return nodeService.listNodes();
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @GetMapping( "/{nodeId}" )
    public NodeStatusResponse getNodeById( @PathVariable UUID nodeId ) {
        return nodeService.getNodeById( nodeId );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN')" )
    @GetMapping( "/{nodeId}/memory" )
    public NodeMemoryDetailResponse getMemoryDetail( @PathVariable UUID nodeId ) {
        return nodeService.getMemoryDetail( nodeId );
    }

    @PreAuthorize( "hasRole('SUPER_ADMIN')" )
    @GetMapping( "/{nodeId}/logs" )
    public ResponseEntity<byte[]> downloadLogs( @PathVariable UUID nodeId ) {
        // Verify node exists
        nodeService.getNodeById( nodeId );

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try ( ZipOutputStream zos = new ZipOutputStream( baos ) ) {
                // Try to add log files if directory exists
                Path logsDir = Paths.get( logsPath ).toAbsolutePath();
                boolean hasLogFiles = false;

                if ( Files.exists( logsDir ) && Files.isDirectory( logsDir ) ) {
                    try ( Stream<Path> files = Files.walk( logsDir, 2 ) ) {
                        List<Path> logFiles = files.filter( Files::isRegularFile )
                                                   .filter( p -> p.toString().endsWith( ".log" ) || p.toString().contains( "spring" ) )
                                                   .toList();

                        for ( Path file : logFiles ) {
                            try {
                                String entryName = logsDir.relativize( file ).toString();
                                zos.putNextEntry( new ZipEntry( "logs/" + entryName ) );
                                Files.copy( file, zos );
                                zos.closeEntry();
                                hasLogFiles = true;
                            } catch ( IOException e ) {
                                log.error( "Failed to add file to zip: {}", file, e );
                            }
                        }
                    }
                } else {
                    log.info( "Logs directory not found: {}. Creating archive with system info only.", logsDir );
                }

                // Always add system info
                String systemInfo = generateSystemInfo( nodeId );
                zos.putNextEntry( new ZipEntry( "system-info.txt" ) );
                zos.write( systemInfo.getBytes( StandardCharsets.UTF_8 ) );
                zos.closeEntry();

                // Add a note about missing logs if applicable
                if ( !hasLogFiles ) {
                    String note = "No log files were found in the configured logs directory.\n" +
                            "This archive contains only system information.\n\n" +
                            "Configured logs path: " + logsPath + "\n" +
                            "Absolute path: " + Paths.get( logsPath ).toAbsolutePath();
                    zos.putNextEntry( new ZipEntry( "README.txt" ) );
                    zos.write( note.getBytes( StandardCharsets.UTF_8 ) );
                    zos.closeEntry();
                }
            }

            byte[] zipBytes = baos.toByteArray();

            String timestamp = LocalDateTime.now().format( DateTimeFormatter.ofPattern( "yyyy-MM-dd_HH-mm-ss" ) );
            String filename = String.format( "node-%s-logs-%s.zip", nodeId.toString().substring( 0, 8 ), timestamp );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType( MediaType.APPLICATION_OCTET_STREAM );
            headers.setContentDispositionFormData( "attachment", filename );
            headers.setContentLength( zipBytes.length );

            return ResponseEntity.ok()
                                 .headers( headers )
                                 .body( zipBytes );

        } catch ( ResponseStatusException e ) {
            throw e;
        } catch ( IOException e ) {
            log.error( "Failed to create logs archive", e );
            throw new ResponseStatusException( HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create logs archive" );
        }
    }

    private String generateSystemInfo( UUID nodeId ) {
        NodeStatusResponse node = nodeService.getNodeById( nodeId );
        NodeMemoryDetailResponse memory = nodeService.getMemoryDetail( nodeId );

        StringBuilder sb = new StringBuilder();
        sb.append( "=== Node System Information ===\n\n" );
        sb.append( String.format( "Node ID: %s%n", node.getId() ) );
        sb.append( String.format( "Node Key: %s%n", node.getNodeKey() ) );
        sb.append( String.format( "Hostname: %s%n", node.getHostname() ) );
        sb.append( String.format( "IP: %s%n", node.getIp() ) );
        sb.append( String.format( "Port: %s%n", node.getPort() ) );
        sb.append( String.format( "Uptime: %d seconds%n", node.getUptimeSeconds() ) );
        sb.append( String.format( "Last Reported: %s%n", node.getLastReportedAt() ) );
        sb.append( "\n=== Resource Usage ===\n\n" );
        sb.append( String.format( "CPU Load: %.2f%%%n", node.getCpuLoad() != null ? node.getCpuLoad() * 100 : 0 ) );
        sb.append( String.format( "System Memory Total: %d bytes%n", node.getSystemMemoryTotal() ) );
        sb.append( String.format( "System Memory Free: %d bytes%n", node.getSystemMemoryFree() ) );
        sb.append( String.format( "Heap Used: %d bytes%n", node.getHeapUsed() ) );
        sb.append( String.format( "Heap Max: %d bytes%n", node.getHeapMax() ) );
        sb.append( String.format( "Disk Total: %d bytes%n", node.getDiskTotal() ) );
        sb.append( String.format( "Disk Free: %d bytes%n", node.getDiskFree() ) );
        sb.append( "\n=== Memory Detail ===\n\n" );
        if ( memory.getMemoryUsage() != null ) {
            sb.append( String.format( "RSS: %d bytes%n", memory.getMemoryUsage().getRss() ) );
            sb.append( String.format( "Heap Total: %d bytes%n", memory.getMemoryUsage().getHeapTotal() ) );
            sb.append( String.format( "Heap Used: %d bytes%n", memory.getMemoryUsage().getHeapUsed() ) );
            sb.append( String.format( "External: %d bytes%n", memory.getMemoryUsage().getExternal() ) );
            sb.append( String.format( "Array Buffers: %d bytes%n", memory.getMemoryUsage().getArrayBuffers() ) );
        }

        sb.append( "\n=== Top 10 Processes by Memory ===\n\n" );
        if ( memory.getTopProcessesByMemory() != null && !memory.getTopProcessesByMemory().isEmpty() ) {
            sb.append( String.format( "%-8s %-12s %-8s %-8s %-12s %-12s %s%n",
                    "PID", "USER", "CPU%", "MEM%", "RSS(KB)", "VSZ(KB)", "COMMAND" ) );
            sb.append( "-".repeat( 100 ) ).append( "\n" );
            for ( var proc : memory.getTopProcessesByMemory() ) {
                sb.append( String.format( "%-8d %-12s %-8.1f %-8s %-12d %-12d %s%n",
                        proc.getPid(),
                        proc.getUser() != null ? proc.getUser() : "N/A",
                        proc.getCpuPercent() != null ? proc.getCpuPercent() : 0.0,
                        proc.getMemoryPercent() != null ? String.format( "%.1f", proc.getMemoryPercent() ) : "N/A",
                        proc.getResidentMemoryKb() != null ? proc.getResidentMemoryKb() : 0,
                        proc.getVirtualMemoryKb() != null ? proc.getVirtualMemoryKb() : 0,
                        proc.getCommand() != null ? proc.getCommand() : "" ) );
            }
        } else {
            sb.append( "Unable to retrieve process information.\n" );
        }

        sb.append( String.format( "%nGenerated at: %s%n", LocalDateTime.now() ) );

        return sb.toString();
    }
}
