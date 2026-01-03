package com.library.tracker.web;

import com.library.tracker.service.NodeService;
import com.library.tracker.web.dto.NodeStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping( "/api/v1/nodes" )
@RequiredArgsConstructor
public class NodeController {

    private final NodeService nodeService;

    @PreAuthorize( "hasRole('ADMIN')" )
    @GetMapping
    public List<NodeStatusResponse> listNodes() {
        return nodeService.listNodes();
    }
}
