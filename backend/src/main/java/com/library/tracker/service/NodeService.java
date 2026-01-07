package com.library.tracker.service;

import com.library.tracker.domain.SystemNode;
import com.library.tracker.repository.SystemNodeRepository;
import com.library.tracker.web.dto.NodeMemoryDetailResponse;
import com.library.tracker.web.dto.NodeMemoryDetailResponse.MemoryUsageDto;
import com.library.tracker.web.dto.NodeMemoryDetailResponse.ProcessInfoDto;
import com.library.tracker.web.dto.NodeMemoryDetailResponse.V8HeapStatisticsDto;
import com.library.tracker.web.dto.NodeStatusResponse;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.MemoryUsage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class NodeService {

    private static final int TOP_PROCESSES_LIMIT = 10;
    private static final String NODE_NOT_FOUND = "Node not found";

    private final SystemNodeRepository systemNodeRepository;
    private final NodeInfoProvider nodeInfoProvider;

    @Transactional
    public void refreshCurrentNode() {
        NodeSnapshot snapshot = nodeInfoProvider.captureSnapshot();
        SystemNode node = systemNodeRepository.findByNodeKey( snapshot.nodeKey() )
                .orElseGet( SystemNode::new );
        updateNodeFromSnapshot( node, snapshot );
        systemNodeRepository.save( node );
        log.debug( "Updated node heartbeat for {}", snapshot.nodeKey() );
    }

    private void updateNodeFromSnapshot( SystemNode node, NodeSnapshot snapshot ) {
        node.setNodeKey( snapshot.nodeKey() );
        node.setHostname( snapshot.hostname() );
        node.setIp( snapshot.ip() );
        node.setPort( snapshot.port() );
        node.setCpuLoad( snapshot.cpuLoad() );
        node.setSystemMemoryTotal( snapshot.systemMemoryTotal() );
        node.setSystemMemoryFree( snapshot.systemMemoryFree() );
        node.setHeapUsed( snapshot.heapUsed() );
        node.setHeapCommitted( snapshot.heapCommitted() );
        node.setHeapMax( snapshot.heapMax() );
        node.setDiskTotal( snapshot.diskTotal() );
        node.setDiskFree( snapshot.diskFree() );
        node.setUptimeSeconds( snapshot.uptimeSeconds() );
        node.setLastReportedAt( snapshot.capturedAt() );
    }

    @Transactional( readOnly = true )
    public List<NodeStatusResponse> listNodes() {
        return systemNodeRepository.findAll()
                .stream()
                .sorted( nodeComparator() )
                .map( this::toResponse )
                .toList();
    }

    private Comparator<SystemNode> nodeComparator() {
        return Comparator
                .comparing( SystemNode::getLastReportedAt, Comparator.nullsLast( Comparator.reverseOrder() ) )
                .thenComparing( SystemNode::getCreatedAt, Comparator.nullsLast( Comparator.reverseOrder() ) );
    }

    @Transactional( readOnly = true )
    public NodeStatusResponse getNodeById( UUID nodeId ) {
        SystemNode node = findNodeOrThrow( nodeId );
        return toResponse( node );
    }

    @Transactional( readOnly = true )
    public NodeMemoryDetailResponse getMemoryDetail( UUID nodeId ) {
        SystemNode node = findNodeOrThrow( nodeId );
        MemoryMXBean memoryMXBean = ManagementFactory.getMemoryMXBean();

        return NodeMemoryDetailResponse.builder()
                .nodeId( node.getId() )
                .nodeKey( node.getNodeKey() )
                .memoryUsage( buildMemoryUsageDto( memoryMXBean ) )
                .v8HeapStatistics( buildV8HeapStatisticsDto( memoryMXBean ) )
                .topProcessesByMemory( getTopProcessesByMemory( TOP_PROCESSES_LIMIT ) )
                .timestamp( LocalDateTime.now() )
                .build();
    }

    private SystemNode findNodeOrThrow( UUID nodeId ) {
        return systemNodeRepository.findById( nodeId )
                .orElseThrow( () -> new ResponseStatusException( HttpStatus.NOT_FOUND, NODE_NOT_FOUND ) );
    }

    private MemoryUsageDto buildMemoryUsageDto( MemoryMXBean memoryMXBean ) {
        MemoryUsage heapUsage = memoryMXBean.getHeapMemoryUsage();
        MemoryUsage nonHeapUsage = memoryMXBean.getNonHeapMemoryUsage();

        return MemoryUsageDto.builder()
                .rss( Runtime.getRuntime().totalMemory() )
                .heapTotal( heapUsage.getCommitted() )
                .heapUsed( heapUsage.getUsed() )
                .external( nonHeapUsage.getUsed() )
                .arrayBuffers( calculateArrayBuffers() )
                .build();
    }

    private long calculateArrayBuffers() {
        long arrayBuffers = 0L;
        for ( MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans() ) {
            if ( isDirectOrMappedPool( pool.getName() ) ) {
                MemoryUsage usage = pool.getUsage();
                if ( usage != null ) {
                    arrayBuffers += usage.getUsed();
                }
            }
        }
        return arrayBuffers;
    }

    private boolean isDirectOrMappedPool( String poolName ) {
        String lowerName = poolName.toLowerCase();
        return lowerName.contains( "direct" ) || lowerName.contains( "mapped" );
    }

    private V8HeapStatisticsDto buildV8HeapStatisticsDto( MemoryMXBean memoryMXBean ) {
        MemoryUsage heapUsage = memoryMXBean.getHeapMemoryUsage();
        MemoryUsage nonHeapUsage = memoryMXBean.getNonHeapMemoryUsage();

        return V8HeapStatisticsDto.builder()
                .totalHeapSize( heapUsage.getCommitted() )
                .usedHeapSize( heapUsage.getUsed() )
                .heapSizeLimit( getPositiveOrNull( heapUsage.getMax() ) )
                .totalAvailableSize( calculateAvailableSize( heapUsage ) )
                .totalPhysicalSize( heapUsage.getCommitted() )
                .mallocedMemory( nonHeapUsage.getUsed() )
                .peakMallocedMemory( getPeakMallocedMemory( nonHeapUsage ) )
                .build();
    }

    private Long getPositiveOrNull( long value ) {
        return value >= 0 ? value : null;
    }

    private Long calculateAvailableSize( MemoryUsage heapUsage ) {
        return heapUsage.getMax() >= 0 ? heapUsage.getMax() - heapUsage.getUsed() : null;
    }

    private long getPeakMallocedMemory( MemoryUsage nonHeapUsage ) {
        return nonHeapUsage.getMax() >= 0 ? nonHeapUsage.getMax() : nonHeapUsage.getCommitted();
    }

    private List<ProcessInfoDto> getTopProcessesByMemory( int limit ) {
        String os = System.getProperty( "os.name" ).toLowerCase();
        log.debug( "Getting top processes for OS: {}", os );
        try {
            List<ProcessInfoDto> result = os.contains( "win" )
                    ? getWindowsProcesses( limit )
                    : getUnixProcesses( limit );
            log.debug( "Found {} processes", result.size() );
            return result;
        } catch ( Exception e ) {
            log.error( "Failed to get top processes by memory", e );
            return new ArrayList<>();
        }
    }

    private List<ProcessInfoDto> getUnixProcesses( int limit ) throws Exception {
        List<ProcessInfoDto> processes = readProcessesFromProc();
        log.debug( "Read {} processes from /proc", processes.size() );
        return processes.stream()
                .sorted( Comparator.comparingLong( ProcessInfoDto::getResidentMemoryKb ).reversed() )
                .limit( limit )
                .toList();
    }

    private List<ProcessInfoDto> readProcessesFromProc() {
        List<ProcessInfoDto> processes = new ArrayList<>();
        File procDir = new File( "/proc" );
        File[] pidDirs = procDir.listFiles( f -> f.isDirectory() && f.getName().matches( "\\d+" ) );

        if ( pidDirs == null ) {
            log.warn( "/proc directory not accessible" );
            return processes;
        }

        long pageSize = getPageSizeKb();
        for ( File pidDir : pidDirs ) {
            ProcessInfoDto info = readProcessInfo( pidDir, pageSize );
            if ( info != null ) {
                processes.add( info );
            }
        }
        return processes;
    }

    private long getPageSizeKb() {
        try {
            ProcessBuilder pb = new ProcessBuilder( "getconf", "PAGE_SIZE" );
            Process p = pb.start();
            try ( BufferedReader r = new BufferedReader( new InputStreamReader( p.getInputStream() ) ) ) {
                String line = r.readLine();
                p.waitFor();
                return line != null ? Long.parseLong( line.trim() ) / 1024 : 4;
            }
        } catch ( Exception e ) {
            return 4; // default 4KB
        }
    }

    private ProcessInfoDto readProcessInfo( File pidDir, long pageSizeKb ) {
        try {
            long pid = Long.parseLong( pidDir.getName() );
            String command = readCommand( pidDir );
            long[] memory = readMemory( pidDir, pageSizeKb );
            String user = getProcessOwner( pidDir );

            return ProcessInfoDto.builder()
                    .pid( pid )
                    .user( user )
                    .cpuPercent( 0.0 )
                    .memoryPercent( null )
                    .residentMemoryKb( memory[0] )
                    .virtualMemoryKb( memory[1] )
                    .command( command )
                    .build();
        } catch ( Exception e ) {
            return null;
        }
    }

    private String readCommand( File pidDir ) {
        try {
            Path cmdlinePath = pidDir.toPath().resolve( "cmdline" );
            String cmdline = Files.readString( cmdlinePath ).replace( '\0', ' ' ).trim();
            if ( !cmdline.isEmpty() ) {
                return cmdline;
            }
            Path commPath = pidDir.toPath().resolve( "comm" );
            return "[" + Files.readString( commPath ).trim() + "]";
        } catch ( Exception e ) {
            return "[unknown]";
        }
    }

    private long[] readMemory( File pidDir, long pageSizeKb ) {
        try {
            Path statmPath = pidDir.toPath().resolve( "statm" );
            String statm = Files.readString( statmPath ).trim();
            String[] parts = statm.split( "\\s+" );
            long vszPages = Long.parseLong( parts[0] );
            long rssPages = Long.parseLong( parts[1] );
            return new long[] { rssPages * pageSizeKb, vszPages * pageSizeKb };
        } catch ( Exception e ) {
            return new long[] { 0, 0 };
        }
    }

    private String getProcessOwner( File pidDir ) {
        try {
            Path statusPath = pidDir.toPath().resolve( "status" );
            for ( String line : Files.readAllLines( statusPath ) ) {
                if ( line.startsWith( "Uid:" ) ) {
                    String[] parts = line.split( "\\s+" );
                    return parts.length > 1 ? "uid:" + parts[1] : "unknown";
                }
            }
        } catch ( Exception e ) {
            // ignore
        }
        return "unknown";
    }

    private List<ProcessInfoDto> getWindowsProcesses( int limit ) {
        try {
            ProcessBuilder pb = new ProcessBuilder( "tasklist", "/FO", "CSV", "/NH" );
            pb.redirectErrorStream( true );
            Process process = pb.start();

            List<ProcessWithMemory> allProcesses = parseTasklistOutput( process );
            int exitCode = process.waitFor();
            log.debug( "tasklist exited with code {}, parsed {} processes", exitCode, allProcesses.size() );

            return convertToProcessInfoList( allProcesses, limit );
        } catch ( Exception e ) {
            log.error( "Failed to get Windows processes via tasklist", e );
            return new ArrayList<>();
        }
    }

    private List<ProcessWithMemory> parseTasklistOutput( Process process ) throws Exception {
        List<ProcessWithMemory> allProcesses = new ArrayList<>();
        try ( BufferedReader reader = new BufferedReader(
                new InputStreamReader( process.getInputStream(), "CP866" ) ) ) {
            String line;
            while ( ( line = reader.readLine() ) != null ) {
                ProcessWithMemory pwm = parseTasklistLine( line );
                if ( pwm != null ) {
                    allProcesses.add( pwm );
                }
            }
        }
        log.debug( "Parsed {} lines from tasklist", allProcesses.size() );
        return allProcesses;
    }

    private ProcessWithMemory parseTasklistLine( String line ) {
        // Format: "name.exe","PID","Session Name","Session#","Mem Usage"
        // Example: "chrome.exe","1234","Console","1","150,000 K"
        String trimmed = line.trim();
        if ( trimmed.isEmpty() || !trimmed.startsWith( "\"" ) ) {
            return null;
        }
        try {
            String[] parts = parseCsvLine( trimmed );
            if ( parts.length >= 5 ) {
                String name = parts[0];
                long pid = Long.parseLong( parts[1] );
                long memoryKb = parseMemoryString( parts[4] );
                // tasklist shows memory in KB, convert to bytes for consistency
                return new ProcessWithMemory( pid, name, memoryKb * 1024L, 0 );
            }
        } catch ( Exception e ) {
            log.trace( "Failed to parse tasklist line: {}", line, e );
        }
        return null;
    }

    private String[] parseCsvLine( String line ) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for ( char c : line.toCharArray() ) {
            if ( c == '"' ) {
                inQuotes = !inQuotes;
            } else if ( c == ',' && !inQuotes ) {
                result.add( current.toString() );
                current = new StringBuilder();
            } else {
                current.append( c );
            }
        }
        result.add( current.toString() );
        return result.toArray( new String[0] );
    }

    private long parseMemoryString( String memStr ) {
        // "150,000 K" or "150 000 K" -> 150000
        String cleaned = memStr.replaceAll( "[^0-9]", "" );
        return cleaned.isEmpty() ? 0 : Long.parseLong( cleaned );
    }

    private List<ProcessInfoDto> convertToProcessInfoList( List<ProcessWithMemory> processes, int limit ) {
        return processes.stream()
                .sorted( Comparator.comparingLong( ProcessWithMemory::workingSet ).reversed() )
                .limit( limit )
                .map( this::toProcessInfoDto )
                .toList();
    }

    private ProcessInfoDto toProcessInfoDto( ProcessWithMemory p ) {
        return ProcessInfoDto.builder()
                .pid( p.pid() )
                .user( "N/A" )
                .cpuPercent( 0.0 )
                .memoryPercent( null )
                .residentMemoryKb( p.workingSet() / 1024 )
                .virtualMemoryKb( p.virtualSize() / 1024 )
                .command( p.name() )
                .build();
    }

    private long parseLongSafe( String value ) {
        try {
            return Long.parseLong( value );
        } catch ( NumberFormatException e ) {
            return 0L;
        }
    }

    private record ProcessWithMemory( long pid, String name, long workingSet, long virtualSize ) {
    }

    private NodeStatusResponse toResponse( SystemNode node ) {
        return NodeStatusResponse.builder()
                .id( node.getId() )
                .nodeKey( node.getNodeKey() )
                .hostname( node.getHostname() )
                .ip( node.getIp() )
                .port( node.getPort() )
                .cpuLoad( node.getCpuLoad() )
                .systemMemoryTotal( node.getSystemMemoryTotal() )
                .systemMemoryFree( node.getSystemMemoryFree() )
                .heapUsed( node.getHeapUsed() )
                .heapCommitted( node.getHeapCommitted() )
                .heapMax( node.getHeapMax() )
                .diskTotal( node.getDiskTotal() )
                .diskFree( node.getDiskFree() )
                .uptimeSeconds( node.getUptimeSeconds() )
                .lastReportedAt( node.getLastReportedAt() )
                .createdAt( node.getCreatedAt() )
                .updatedAt( node.getUpdatedAt() )
                .build();
    }
}
