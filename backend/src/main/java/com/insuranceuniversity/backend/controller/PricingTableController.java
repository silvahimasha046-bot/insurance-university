package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.PricingTableEntity;
import com.insuranceuniversity.backend.repository.PricingTableRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/pricing-tables")
public class PricingTableController {

    private final PricingTableRepository repo;

    public PricingTableController(PricingTableRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<PricingTableEntity> list() {
        return repo.findAll();
    }

    @PostMapping
    public PricingTableEntity create(@RequestBody PricingTableEntity entity) {
        return repo.save(entity);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PricingTableEntity> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<PricingTableEntity> update(@PathVariable Long id,
                                                     @RequestBody PricingTableEntity body) {
        return repo.findById(id).map(existing -> {
            existing.setName(body.getName());
            existing.setPricingJson(body.getPricingJson());
            existing.setVersion(body.getVersion());
            existing.setEffectiveFrom(body.getEffectiveFrom());
            existing.setEffectiveTo(body.getEffectiveTo());
            return ResponseEntity.ok(repo.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
