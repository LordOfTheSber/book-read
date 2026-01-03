package com.library.tracker.service;

import com.library.tracker.domain.SystemNode;
import com.library.tracker.repository.SystemNodeRepository;
import com.library.tracker.web.dto.NodeStatusResponse;

import java.util.Comparator;
import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class NodeService {

    private final SystemNodeRepository systemNodeRepository;
    private final NodeInfoProvider nodeInfoProvider;

    @Transactional
    public void refreshCurrentNode() {
        NodeSnapshot snapshot = nodeInfoProvider.captureSnapshot();
        SystemNode node = systemNodeRepository.findByNodeKey( snapshot.nodeKey() )
                                              .orElseGet( SystemNode::new );
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
        systemNodeRepository.save( node );
        log.debug( "Updated node heartbeat for {}", snapshot.nodeKey() );
    }

    @Transactional( readOnly = true )
    public List<NodeStatusResponse> listNodes() {
        return systemNodeRepository.findAll()
                                   .stream()
                                   .sorted( Comparator.comparing( SystemNode::getLastReportedAt, Comparator.nullsLast( Comparator.reverseOrder() ) )
                                                      .thenComparing( SystemNode::getCreatedAt, Comparator.nullsLast( Comparator.reverseOrder() ) ) )
                                   .map( this::toResponse )
                                   .toList();
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
