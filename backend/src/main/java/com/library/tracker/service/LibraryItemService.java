package com.library.tracker.service;

import com.library.tracker.domain.BookType;
import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.MediaKind;
import com.library.tracker.repository.BookTypeRepository;
import com.library.tracker.repository.LibraryItemRepository;
import com.library.tracker.web.dto.LibraryItemFilter;
import com.library.tracker.web.dto.LibraryItemRequest;
import com.library.tracker.web.dto.LibraryItemResponse;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class LibraryItemService {

    private final LibraryItemRepository libraryItemRepository;
    private final BookTypeRepository bookTypeRepository;

    public Page<LibraryItemResponse> getItems(LibraryItemFilter filter) {
        PageRequest pageRequest = PageRequest.of(filter.page(), filter.size(), filter.sort());
        return libraryItemRepository.findAll(buildSpecification(filter), pageRequest)
                .map(this::toResponse);
    }

    public Optional<LibraryItemResponse> getById(UUID id) {
        return libraryItemRepository.findById(id).map(this::toResponse);
    }

    public LibraryItemResponse create(LibraryItemRequest request) {
        LibraryItem item = new LibraryItem();
        applyRequest(item, request);
        return toResponse(libraryItemRepository.save(item));
    }

    public Optional<LibraryItemResponse> update(UUID id, LibraryItemRequest request) {
        return libraryItemRepository.findById(id).map(existing -> {
            applyRequest(existing, request);
            return toResponse(libraryItemRepository.save(existing));
        });
    }

    public void delete(UUID id) {
        libraryItemRepository.deleteById(id);
    }

    private void applyRequest(LibraryItem item, LibraryItemRequest request) {
        item.setKind(Optional.ofNullable(request.getKind()).orElse(MediaKind.BOOK));
        item.setTitle(request.getTitle());
        item.setAltTitle(request.getAltTitle());
        item.setComment(request.getComment());
        item.setRating(request.getRating());
        item.setFavorite(request.isFavorite());
        item.setStatus(request.getStatus());
        if (request.getTypeId() != null) {
            BookType type = bookTypeRepository.findById(request.getTypeId())
                    .orElseThrow(() -> new IllegalArgumentException("Type not found"));
            item.setType(type);
        } else {
            item.setType(null);
        }
    }

    private Specification<LibraryItem> buildSpecification(LibraryItemFilter filter) {
        return (root, query, cb) -> {
            Specification<LibraryItem> spec = Specification.where(null);
            if (filter.query().isPresent()) {
                String like = "%" + filter.query().get().toLowerCase() + "%";
                spec = spec.and((r, q, c) -> c.or(
                        c.like(c.lower(r.get("title")), like),
                        c.like(c.lower(r.get("altTitle")), like)));
            }
            if (filter.typeId().isPresent()) {
                spec = spec.and((r, q, c) -> c.equal(r.join("type").get("id"), filter.typeId().get()));
            }
            if (filter.status().isPresent()) {
                spec = spec.and((r, q, c) -> c.equal(r.get("status"), filter.status().get()));
            }
            if (filter.favorite().isPresent()) {
                spec = spec.and((r, q, c) -> c.equal(r.get("favorite"), filter.favorite().get()));
            }
            if (filter.minRating().isPresent()) {
                spec = spec.and((r, q, c) -> c.ge(r.get("rating"), filter.minRating().get()));
            }
            if (filter.maxRating().isPresent()) {
                spec = spec.and((r, q, c) -> c.le(r.get("rating"), filter.maxRating().get()));
            }
            if (filter.createdFrom().isPresent()) {
                spec = spec.and((r, q, c) -> c.greaterThanOrEqualTo(r.get("createdAt"), filter.createdFrom().get()));
            }
            if (filter.createdTo().isPresent()) {
                spec = spec.and((r, q, c) -> c.lessThanOrEqualTo(r.get("createdAt"), filter.createdTo().get()));
            }
            if (filter.updatedFrom().isPresent()) {
                spec = spec.and((r, q, c) -> c.greaterThanOrEqualTo(r.get("updatedAt"), filter.updatedFrom().get()));
            }
            if (filter.updatedTo().isPresent()) {
                spec = spec.and((r, q, c) -> c.lessThanOrEqualTo(r.get("updatedAt"), filter.updatedTo().get()));
            }
            if (filter.kind().isPresent()) {
                spec = spec.and((r, q, c) -> c.equal(r.get("kind"), filter.kind().get()));
            }
            return spec.toPredicate(root, query, cb);
        };
    }

    private LibraryItemResponse toResponse(LibraryItem item) {
        return LibraryItemResponse.builder()
                .id(item.getId())
                .kind(item.getKind())
                .title(item.getTitle())
                .altTitle(item.getAltTitle())
                .typeId(item.getType() != null ? item.getType().getId() : null)
                .typeName(item.getType() != null ? item.getType().getName() : null)
                .comment(item.getComment())
                .rating(item.getRating())
                .favorite(item.isFavorite())
                .status(item.getStatus())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }
}
