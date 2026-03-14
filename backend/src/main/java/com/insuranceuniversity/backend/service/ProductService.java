package com.insuranceuniversity.backend.service;

import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * Returns all products. If none exist yet, seeds default products so the
     * AI engine always has something to score.
     */
    public List<ProductEntity> listProducts() {
        List<ProductEntity> all = productRepository.findAll();
        if (all.isEmpty()) {
            seedDefaults();
            all = productRepository.findAll();
        }
        return all;
    }

    private void seedDefaults() {
        List<ProductEntity> defaults = Arrays.asList(
            product("TERM-BASIC", "Basic Term Life", new BigDecimal("3500.00"), "[\"life\",\"term\"]"),
            product("TERM-PREM", "Premium Term Life", new BigDecimal("5200.00"), "[\"life\",\"term\",\"premium\"]"),
            product("WHOLE-LIFE", "Whole Life Protector", new BigDecimal("7800.00"), "[\"life\",\"whole\",\"savings\"]"),
            product("FAMILY-SHIELD", "Family Shield Plan", new BigDecimal("4500.00"), "[\"life\",\"family\",\"term\"]"),
            product("HEALTH-PLUS", "Health Plus Cover", new BigDecimal("2800.00"), "[\"health\",\"medical\"]"),
            product("SENIOR-CARE", "Senior Care Plan", new BigDecimal("6000.00"), "[\"life\",\"senior\",\"health\"]")
        );
        productRepository.saveAll(defaults);
    }

    private ProductEntity product(String code, String name, BigDecimal premium, String tagsJson) {
        ProductEntity p = new ProductEntity();
        p.setCode(code);
        p.setName(name);
        p.setBasePremium(premium);
        p.setTagsJson(tagsJson);
        return p;
    }
}
