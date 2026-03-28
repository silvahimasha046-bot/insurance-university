package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.InsuranceCategoryEntity;
import com.insuranceuniversity.backend.entity.InsuranceSubcategoryEntity;
import com.insuranceuniversity.backend.repository.InsuranceCategoryRepository;
import com.insuranceuniversity.backend.repository.InsuranceSubcategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class ProductHierarchyAdminController {

    private final InsuranceCategoryRepository categoryRepository;
    private final InsuranceSubcategoryRepository subcategoryRepository;

    public ProductHierarchyAdminController(InsuranceCategoryRepository categoryRepository,
                                           InsuranceSubcategoryRepository subcategoryRepository) {
        this.categoryRepository = categoryRepository;
        this.subcategoryRepository = subcategoryRepository;
    }

    @GetMapping("/categories")
    public List<InsuranceCategoryEntity> listCategories() {
        return categoryRepository.findAllByOrderByDisplayOrderAscNameAsc();
    }

    @PostMapping("/categories")
    public ResponseEntity<InsuranceCategoryEntity> createCategory(@RequestBody InsuranceCategoryEntity body) {
        if (body.getCode() == null || body.getCode().isBlank() || body.getName() == null || body.getName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (categoryRepository.existsByCodeIgnoreCase(body.getCode())) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(categoryRepository.save(body));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<InsuranceCategoryEntity> updateCategory(@PathVariable Long id,
                                                                  @RequestBody InsuranceCategoryEntity body) {
        return categoryRepository.findById(id).map(existing -> {
            existing.setCode(body.getCode());
            existing.setName(body.getName());
            existing.setDescription(body.getDescription());
            existing.setActive(body.getActive());
            existing.setDisplayOrder(body.getDisplayOrder());
            return ResponseEntity.ok(categoryRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        if (!categoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        categoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/subcategories")
    public List<InsuranceSubcategoryEntity> listSubcategories(@RequestParam(required = false) Long categoryId) {
        if (categoryId != null) {
            return subcategoryRepository.findByCategoryIdOrderByDisplayOrderAscNameAsc(categoryId);
        }
        return subcategoryRepository.findAllByOrderByDisplayOrderAscNameAsc();
    }

    @PostMapping("/subcategories")
    public ResponseEntity<InsuranceSubcategoryEntity> createSubcategory(@RequestBody InsuranceSubcategoryEntity body) {
        if (body.getCode() == null || body.getCode().isBlank() || body.getName() == null || body.getName().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (body.getCategory() == null || body.getCategory().getId() == null) {
            return ResponseEntity.badRequest().build();
        }

        InsuranceCategoryEntity category = categoryRepository.findById(body.getCategory().getId()).orElse(null);
        if (category == null) {
            return ResponseEntity.badRequest().build();
        }

        body.setCategory(category);
        return ResponseEntity.ok(subcategoryRepository.save(body));
    }

    @PutMapping("/subcategories/{id}")
    public ResponseEntity<InsuranceSubcategoryEntity> updateSubcategory(@PathVariable Long id,
                                                                        @RequestBody InsuranceSubcategoryEntity body) {
        return subcategoryRepository.findById(id).map(existing -> {
            existing.setCode(body.getCode());
            existing.setName(body.getName());
            existing.setDescription(body.getDescription());
            existing.setActive(body.getActive());
            existing.setDisplayOrder(body.getDisplayOrder());

            if (body.getCategory() != null && body.getCategory().getId() != null) {
                InsuranceCategoryEntity category = categoryRepository.findById(body.getCategory().getId()).orElse(null);
                if (category == null) {
                    return ResponseEntity.badRequest().<InsuranceSubcategoryEntity>build();
                }
                existing.setCategory(category);
            }
            return ResponseEntity.ok(subcategoryRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/subcategories/{id}")
    public ResponseEntity<Void> deleteSubcategory(@PathVariable Long id) {
        if (!subcategoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        subcategoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}