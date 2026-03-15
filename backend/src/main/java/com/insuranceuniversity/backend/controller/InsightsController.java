package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.UnmatchedNeedEntity;
import com.insuranceuniversity.backend.repository.UnmatchedNeedRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/insights/unmatched-needs")
public class InsightsController {

    private final UnmatchedNeedRepository repo;

    public InsightsController(UnmatchedNeedRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<UnmatchedNeedEntity> list() {
        return repo.findAll();
    }

    @PostMapping
    public UnmatchedNeedEntity create(@RequestBody UnmatchedNeedEntity entity) {
        return repo.save(entity);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
