package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.EligibilityRuleEntity;
import com.insuranceuniversity.backend.repository.EligibilityRuleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/rules")
public class RuleController {

    private final EligibilityRuleRepository repo;

    public RuleController(EligibilityRuleRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<EligibilityRuleEntity> list() {
        return repo.findAll();
    }

    @PostMapping
    public EligibilityRuleEntity create(@RequestBody EligibilityRuleEntity rule) {
        return repo.save(rule);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EligibilityRuleEntity> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<EligibilityRuleEntity> update(@PathVariable Long id,
                                                        @RequestBody EligibilityRuleEntity body) {
        return repo.findById(id).map(existing -> {
            existing.setName(body.getName());
            existing.setRuleJson(body.getRuleJson());
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
