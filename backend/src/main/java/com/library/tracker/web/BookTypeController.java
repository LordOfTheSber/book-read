package com.library.tracker.web;

import com.library.tracker.service.BookTypeService;
import com.library.tracker.web.dto.BookTypeRequest;
import com.library.tracker.web.dto.BookTypeResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/types")
@RequiredArgsConstructor
public class BookTypeController {

    private final BookTypeService bookTypeService;

    @GetMapping
    public List<BookTypeResponse> list() {
        return bookTypeService.findAll();
    }

    @PostMapping
    public ResponseEntity<BookTypeResponse> create(@Valid @RequestBody BookTypeRequest request) {
        return ResponseEntity.ok(bookTypeService.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BookTypeResponse> update(@PathVariable UUID id, @Valid @RequestBody BookTypeRequest request) {
        return bookTypeService.update(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        bookTypeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
