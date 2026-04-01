package com.insuranceuniversity.backend.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.InsuranceCategoryEntity;
import com.insuranceuniversity.backend.entity.InsuranceSubcategoryEntity;
import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.repository.InsuranceCategoryRepository;
import com.insuranceuniversity.backend.repository.InsuranceSubcategoryRepository;
import com.insuranceuniversity.backend.repository.ProductRepository;
import com.insuranceuniversity.backend.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/products")
public class ProductAdminController {

    private final ProductRepository productRepository;
    private final ProductService productService;
    private final InsuranceCategoryRepository categoryRepository;
    private final InsuranceSubcategoryRepository subcategoryRepository;
    private final ObjectMapper objectMapper;

    public ProductAdminController(ProductRepository productRepository,
                                  ProductService productService,
                                  InsuranceCategoryRepository categoryRepository,
                                  InsuranceSubcategoryRepository subcategoryRepository,
                                  ObjectMapper objectMapper) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.categoryRepository = categoryRepository;
        this.subcategoryRepository = subcategoryRepository;
        this.objectMapper = objectMapper;
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
        if (!hasValidBasePremium(entity.getBasePremium())) {
            return ResponseEntity.badRequest().build();
        }
        if (!normalizeAndValidateJson(entity)) {
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
            if (!hasValidBasePremium(body.getBasePremium())) {
                return ResponseEntity.badRequest().<ProductEntity>build();
            }
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
            if (!normalizeAndValidateJson(existing)) {
                return ResponseEntity.badRequest().<ProductEntity>build();
            }
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

    private boolean hasValidBasePremium(BigDecimal premium) {
        return premium != null && premium.compareTo(BigDecimal.ZERO) > 0;
    }

    private boolean normalizeAndValidateJson(ProductEntity product) {
        try {
            product.setEligibilityJson(normalizeEligibilityJson(product.getEligibilityJson()));
            product.setSampleCalculationsJson(normalizeArrayJson(product.getSampleCalculationsJson()));
            product.setBenefitsJson(normalizeArrayJson(product.getBenefitsJson()));
            product.setRidersJson(normalizeArrayJson(product.getRidersJson()));
            product.setPaymentModesJson(normalizePaymentModesJson(product.getPaymentModesJson()));
            return true;
        } catch (JsonProcessingException ex) {
            return false;
        }
    }

    private String normalizeEligibilityJson(String raw) throws JsonProcessingException {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        Map<String, Object> eligibility = objectMapper.readValue(raw, new TypeReference<>() {});
        autoCorrectMinMax(eligibility, "minAge", "maxAge");
        autoCorrectMinMax(eligibility, "minTermYears", "maxTermYears");
        return objectMapper.writeValueAsString(eligibility);
    }

    private void autoCorrectMinMax(Map<String, Object> payload, String minKey, String maxKey) {
        Number min = numberValue(payload.get(minKey));
        Number max = numberValue(payload.get(maxKey));
        if (min == null || max == null) {
            return;
        }
        if (min.doubleValue() > max.doubleValue()) {
            payload.put(minKey, max);
            payload.put(maxKey, min);
        }
    }

    private Number numberValue(Object value) {
        if (value instanceof Number number) {
            return number;
        }
        if (value instanceof String text) {
            try {
                return new BigDecimal(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private String normalizeArrayJson(String raw) throws JsonProcessingException {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        List<Object> data = objectMapper.readValue(raw, new TypeReference<>() {});
        return objectMapper.writeValueAsString(data);
    }

    private String normalizePaymentModesJson(String raw) throws JsonProcessingException {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        List<String> modes = objectMapper.readValue(raw, new TypeReference<>() {});
        List<String> normalized = new ArrayList<>();
        for (String mode : modes) {
            if (mode == null) {
                continue;
            }
            String cleaned = mode.trim();
            if (cleaned.equalsIgnoreCase("half-yearly") || cleaned.equalsIgnoreCase("half yearly")) {
                cleaned = "HalfYearly";
            } else if (cleaned.equalsIgnoreCase("monthly")) {
                cleaned = "Monthly";
            } else if (cleaned.equalsIgnoreCase("quarterly")) {
                cleaned = "Quarterly";
            } else if (cleaned.equalsIgnoreCase("annual") || cleaned.equalsIgnoreCase("yearly")) {
                cleaned = "Annual";
            } else if (cleaned.equalsIgnoreCase("single")) {
                cleaned = "Single";
            }
            if (!normalized.contains(cleaned)) {
                normalized.add(cleaned);
            }
        }
        return objectMapper.writeValueAsString(normalized);
    }
}
