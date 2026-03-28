package com.insuranceuniversity.backend.service;

import com.insuranceuniversity.backend.entity.InsuranceCategoryEntity;
import com.insuranceuniversity.backend.entity.InsuranceSubcategoryEntity;
import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.repository.InsuranceCategoryRepository;
import com.insuranceuniversity.backend.repository.InsuranceSubcategoryRepository;
import com.insuranceuniversity.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final InsuranceCategoryRepository categoryRepository;
    private final InsuranceSubcategoryRepository subcategoryRepository;

    public ProductService(ProductRepository productRepository,
                          InsuranceCategoryRepository categoryRepository,
                          InsuranceSubcategoryRepository subcategoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.subcategoryRepository = subcategoryRepository;
    }

    /**
     * Returns all products. If none exist yet, seeds default products so the
     * AI engine always has something to score.
     */
    public List<ProductEntity> listProducts() {
        ensureHierarchySeed();
        List<ProductEntity> all = productRepository.findAll();
        if (all.isEmpty()) {
            seedDefaults();
            all = productRepository.findAll();
        } else {
            backfillHierarchyIfMissing(all);
            all = productRepository.findAll();
        }
        return all;
    }

    public List<ProductEntity> listProducts(Long categoryId, Long subcategoryId) {
        ensureHierarchySeed();
        if (subcategoryId != null && categoryId != null) {
            return productRepository.findByCategoryIdAndSubcategoryId(categoryId, subcategoryId);
        }
        if (subcategoryId != null) {
            return productRepository.findBySubcategoryId(subcategoryId);
        }
        if (categoryId != null) {
            return productRepository.findByCategoryId(categoryId);
        }
        return listProducts();
    }

    private void ensureHierarchySeed() {
        InsuranceCategoryEntity life = findOrCreateCategory(
                "LIFE_INSURANCE", "Life Insurance", true, 1,
                "Life protection and long-term security plans"
        );
        findOrCreateCategory("RETIREMENT_PLANS", "Retirement Plans", false, 2,
                "Placeholder category for future retirement products");
        findOrCreateCategory("MEDICAL_PLANS", "Medical Plans", false, 3,
                "Placeholder category for future medical products");
        findOrCreateCategory("LIFE_INVESTMENT", "Life Investment", false, 4,
                "Placeholder category for future life investment products");

//        findOrCreateSubcategory(
//                "LIFE_PROTECTION_PLANS",
//                "Protection Plans",
//                life,
//                1,
//                "Protection-focused life products in the first rollout"
//        );
    }

    private void seedDefaults() {
        InsuranceCategoryEntity life = categoryRepository.findByCodeIgnoreCase("LIFE_INSURANCE")
                .orElseThrow(() -> new IllegalStateException("LIFE_INSURANCE category must be seeded"));
        InsuranceSubcategoryEntity protection = subcategoryRepository.findByCodeIgnoreCase("LIFE_PROTECTION_PLANS")
                .orElseThrow(() -> new IllegalStateException("LIFE_PROTECTION_PLANS subcategory must be seeded"));

        List<ProductEntity> defaults = Arrays.asList(
            product("ENDOWMENT", "Endowment", new BigDecimal("3500.00"), "[\"life\",\"protection\",\"endowment\"]", life, protection),
            product("ADVANCED-PAYMENT", "Advanced Payment", new BigDecimal("4200.00"), "[\"life\",\"protection\",\"advanced-payment\"]", life, protection),
            product("SMART-PROTECTION", "Smart Protection", new BigDecimal("5100.00"), "[\"life\",\"protection\",\"smart\"]", life, protection),
            product("SUPREME", "Supreme", new BigDecimal("5900.00"), "[\"life\",\"protection\",\"supreme\"]", life, protection),
            product("SAUBHAGYA", "Saubhagya", new BigDecimal("5600.00"), "[\"life\",\"protection\",\"saubhagya\"]", life, protection)
        );
        productRepository.saveAll(defaults);
    }

    private void backfillHierarchyIfMissing(List<ProductEntity> products) {
        Optional<InsuranceCategoryEntity> lifeOpt = categoryRepository.findByCodeIgnoreCase("LIFE_INSURANCE");
        Optional<InsuranceCategoryEntity> medicalOpt = categoryRepository.findByCodeIgnoreCase("MEDICAL_PLANS");
        Optional<InsuranceSubcategoryEntity> protectionOpt = subcategoryRepository.findByCodeIgnoreCase("LIFE_PROTECTION_PLANS");
        if (lifeOpt.isEmpty() || protectionOpt.isEmpty()) {
            return;
        }

        InsuranceCategoryEntity life = lifeOpt.get();
        InsuranceCategoryEntity medical = medicalOpt.orElse(null);
        InsuranceSubcategoryEntity protection = protectionOpt.get();

        boolean changed = false;
        for (ProductEntity p : products) {
            if (p.getCategory() != null || p.getSubcategory() != null) {
                continue;
            }

            String tags = p.getTagsJson() == null ? "" : p.getTagsJson().toLowerCase();
            if (tags.contains("medical") || tags.contains("health")) {
                if (medical != null) {
                    p.setCategory(medical);
                    changed = true;
                }
                continue;
            }

            p.setCategory(life);
            p.setSubcategory(protection);
            changed = true;
        }

        if (changed) {
            productRepository.saveAll(products);
        }
    }

    private ProductEntity product(String code, String name, BigDecimal premium, String tagsJson,
                                  InsuranceCategoryEntity category,
                                  InsuranceSubcategoryEntity subcategory) {
        ProductEntity p = new ProductEntity();
        p.setCode(code);
        p.setName(name);
        p.setBasePremium(premium);
        p.setTagsJson(tagsJson);
        p.setCategory(category);
        p.setSubcategory(subcategory);
        return p;
    }

    private InsuranceCategoryEntity findOrCreateCategory(String code,
                                                         String name,
                                                         boolean active,
                                                         int displayOrder,
                                                         String description) {
        return categoryRepository.findByCodeIgnoreCase(code).orElseGet(() -> {
            InsuranceCategoryEntity entity = new InsuranceCategoryEntity();
            entity.setCode(code);
            entity.setName(name);
            entity.setActive(active);
            entity.setDisplayOrder(displayOrder);
            entity.setDescription(description);
            return categoryRepository.save(entity);
        });
    }

    private InsuranceSubcategoryEntity findOrCreateSubcategory(String code,
                                                               String name,
                                                               InsuranceCategoryEntity category,
                                                               int displayOrder,
                                                               String description) {
        return subcategoryRepository.findByCodeIgnoreCase(code).orElseGet(() -> {
            InsuranceSubcategoryEntity entity = new InsuranceSubcategoryEntity();
            entity.setCode(code);
            entity.setName(name);
            entity.setCategory(category);
            entity.setActive(true);
            entity.setDisplayOrder(displayOrder);
            entity.setDescription(description);
            return subcategoryRepository.save(entity);
        });
    }
}
