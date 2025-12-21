package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.BookTypeRequest;
import com.library.tracker.web.dto.BookTypeResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class BookTypeService {

    private final BookTypeRepository bookTypeRepository;
    private final LibraryItemRepository libraryItemRepository;

    public List<BookTypeResponse> findAll() {
        return bookTypeRepository.findAll().stream().map(this::toResponse).toList();
    }

    public BookTypeResponse create(BookTypeRequest request) {
        if (bookTypeRepository.existsByNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("Type name already exists");
        }
        BookType type = new BookType();
        type.setName(request.getName());
        return toResponse(bookTypeRepository.save(type));
    }

    public Optional<BookTypeResponse> update(UUID id, BookTypeRequest request) {
        return bookTypeRepository.findById(id).map(existing -> {
            if (!existing.getName().equalsIgnoreCase(request.getName())
                    && bookTypeRepository.existsByNameIgnoreCase(request.getName())) {
                throw new IllegalArgumentException("Type name already exists");
            }
            existing.setName(request.getName());
            return toResponse(bookTypeRepository.save(existing));
        });
    }

    public void delete(UUID id) {
        if (libraryItemRepository.existsByTypeId(id)) {
            throw new IllegalStateException("Cannot delete type in use");
        }
        bookTypeRepository.deleteById(id);
    }

    private BookTypeResponse toResponse(BookType type) {
        return BookTypeResponse.builder()
                .id(type.getId())
                .name(type.getName())
                .createdAt(type.getCreatedAt())
                .updatedAt(type.getUpdatedAt())
                .build();
    }
}
