package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.InsuranceCategoryEntity;
import com.insuranceuniversity.backend.entity.InsuranceSubcategoryEntity;
import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.repository.InsuranceCategoryRepository;
import com.insuranceuniversity.backend.repository.InsuranceSubcategoryRepository;
import com.insuranceuniversity.backend.repository.ProductRepository;
import com.insuranceuniversity.backend.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/products")
public class ProductAdminController {

    private final ProductRepository productRepository;
    private final ProductService productService;
    private final InsuranceCategoryRepository categoryRepository;
    private final InsuranceSubcategoryRepository subcategoryRepository;

    public ProductAdminController(ProductRepository productRepository,
                                  ProductService productService,
                                  InsuranceCategoryRepository categoryRepository,
                                  InsuranceSubcategoryRepository subcategoryRepository) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.categoryRepository = categoryRepository;
        this.subcategoryRepository = subcategoryRepository;
    }

    @GetMapping
    public List<ProductEntity> list(@RequestParam(required = false) Long categoryId,
                                    @RequestParam(required = false) Long subcategoryId) {
        return productService.listProducts(categoryId, subcategoryId);
    }

    @PostMapping
    public ResponseEntity<ProductEntity> create(@RequestBody ProductEntity entity) {
        if (entity.getCode() == null || entity.getCode().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (!resolveAndValidateHierarchy(entity)) {
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
            existing.setHowItWorksText(body.getHowItWorksText());
            existing.setBenefitsJson(body.getBenefitsJson());
            existing.setRidersJson(body.getRidersJson());
            existing.setEligibilityJson(body.getEligibilityJson());
            existing.setSampleCalculationsJson(body.getSampleCalculationsJson());
            existing.setPaymentModesJson(body.getPaymentModesJson());
            existing.setAdditionalBenefitsText(body.getAdditionalBenefitsText());
            existing.setMinEligibleAge(body.getMinEligibleAge());
            existing.setMaxEligibleAge(body.getMaxEligibleAge());
            existing.setMinPolicyTermYears(body.getMinPolicyTermYears());
            existing.setMaxPolicyTermYears(body.getMaxPolicyTermYears());

            existing.setCategory(body.getCategory());
            existing.setSubcategory(body.getSubcategory());
            if (!resolveAndValidateHierarchy(existing)) {
                return ResponseEntity.badRequest().<ProductEntity>build();
            }
            return ResponseEntity.ok(productRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!productRepository.existsById(id)) return ResponseEntity.notFound().build();
        productRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean resolveAndValidateHierarchy(ProductEntity product) {
        InsuranceCategoryEntity resolvedCategory = null;
        InsuranceSubcategoryEntity resolvedSubcategory = null;

        if (product.getCategory() != null && product.getCategory().getId() != null) {
            resolvedCategory = categoryRepository.findById(product.getCategory().getId()).orElse(null);
            if (resolvedCategory == null) {
                return false;
            }
        }

        if (product.getSubcategory() != null && product.getSubcategory().getId() != null) {
            resolvedSubcategory = subcategoryRepository.findById(product.getSubcategory().getId()).orElse(null);
            if (resolvedSubcategory == null) {
                return false;
            }
        }

        if (resolvedSubcategory != null && resolvedSubcategory.getCategory() != null) {
            if (resolvedCategory == null) {
                resolvedCategory = resolvedSubcategory.getCategory();
            } else if (!resolvedSubcategory.getCategory().getId().equals(resolvedCategory.getId())) {
                return false;
            }
        }

        product.setCategory(resolvedCategory);
        product.setSubcategory(resolvedSubcategory);
        return true;
    }
}
