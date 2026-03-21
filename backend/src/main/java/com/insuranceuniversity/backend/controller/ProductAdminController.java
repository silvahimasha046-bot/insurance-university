package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.repository.ProductRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/products")
public class ProductAdminController {

    private final ProductRepository productRepository;

    public ProductAdminController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    public List<ProductEntity> list() {
        return productRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<ProductEntity> create(@RequestBody ProductEntity entity) {
        if (entity.getCode() == null || entity.getCode().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(productRepository.save(entity));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductEntity> get(@PathVariable Long id) {
        return productRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductEntity> update(@PathVariable Long id,
                                                @RequestBody ProductEntity body) {
        return productRepository.findById(id).map(existing -> {
            existing.setCode(body.getCode());
            existing.setName(body.getName());
            existing.setBasePremium(body.getBasePremium());
            existing.setTagsJson(body.getTagsJson());
            return ResponseEntity.ok(productRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!productRepository.existsById(id)) return ResponseEntity.notFound().build();
        productRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
