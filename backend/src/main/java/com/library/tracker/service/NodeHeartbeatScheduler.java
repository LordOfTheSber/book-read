package com.library.tracker.service;

import jakarta.annotation.PostConstruct;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NodeHeartbeatScheduler {

    private final NodeService nodeService;

    @PostConstruct
    public void onStartup() {
        sendHeartbeat();
    }

    @Scheduled( fixedDelayString = "${node.heartbeat-interval:10s}" )
    public void sendHeartbeat() {
        try {
            nodeService.refreshCurrentNode();
        } catch ( Exception ex ) {
            log.warn( "Failed to update node heartbeat", ex );
        }
    }
}
