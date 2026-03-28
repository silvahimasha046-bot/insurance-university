package com.insuranceuniversity.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code;

    private String name;

    @Column(precision = 10, scale = 2)
    private BigDecimal basePremium;

    @Column(columnDefinition = "TEXT")
    private String tagsJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private InsuranceCategoryEntity category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subcategory_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private InsuranceSubcategoryEntity subcategory;

    @Column(columnDefinition = "TEXT")
    private String howItWorksText;

    @Column(columnDefinition = "TEXT")
    private String benefitsJson;

    @Column(columnDefinition = "TEXT")
    private String ridersJson;

    @Column(columnDefinition = "TEXT")
    private String eligibilityJson;

    @Column(columnDefinition = "TEXT")
    private String sampleCalculationsJson;

    @Column(columnDefinition = "TEXT")
    private String paymentModesJson;

    @Column(columnDefinition = "TEXT")
    private String additionalBenefitsText;

    private Integer minEligibleAge;
    private Integer maxEligibleAge;
    private Integer minPolicyTermYears;
    private Integer maxPolicyTermYears;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getBasePremium() { return basePremium; }
    public void setBasePremium(BigDecimal basePremium) { this.basePremium = basePremium; }

    public String getTagsJson() { return tagsJson; }
    public void setTagsJson(String tagsJson) { this.tagsJson = tagsJson; }

    public InsuranceCategoryEntity getCategory() { return category; }
    public void setCategory(InsuranceCategoryEntity category) { this.category = category; }

    public InsuranceSubcategoryEntity getSubcategory() { return subcategory; }
    public void setSubcategory(InsuranceSubcategoryEntity subcategory) { this.subcategory = subcategory; }

    public String getHowItWorksText() { return howItWorksText; }
    public void setHowItWorksText(String howItWorksText) { this.howItWorksText = howItWorksText; }

    public String getBenefitsJson() { return benefitsJson; }
    public void setBenefitsJson(String benefitsJson) { this.benefitsJson = benefitsJson; }

    public String getRidersJson() { return ridersJson; }
    public void setRidersJson(String ridersJson) { this.ridersJson = ridersJson; }

    public String getEligibilityJson() { return eligibilityJson; }
    public void setEligibilityJson(String eligibilityJson) { this.eligibilityJson = eligibilityJson; }

    public String getSampleCalculationsJson() { return sampleCalculationsJson; }
    public void setSampleCalculationsJson(String sampleCalculationsJson) { this.sampleCalculationsJson = sampleCalculationsJson; }

    public String getPaymentModesJson() { return paymentModesJson; }
    public void setPaymentModesJson(String paymentModesJson) { this.paymentModesJson = paymentModesJson; }

    public String getAdditionalBenefitsText() { return additionalBenefitsText; }
    public void setAdditionalBenefitsText(String additionalBenefitsText) { this.additionalBenefitsText = additionalBenefitsText; }

    public Integer getMinEligibleAge() { return minEligibleAge; }
    public void setMinEligibleAge(Integer minEligibleAge) { this.minEligibleAge = minEligibleAge; }

    public Integer getMaxEligibleAge() { return maxEligibleAge; }
    public void setMaxEligibleAge(Integer maxEligibleAge) { this.maxEligibleAge = maxEligibleAge; }

    public Integer getMinPolicyTermYears() { return minPolicyTermYears; }
    public void setMinPolicyTermYears(Integer minPolicyTermYears) { this.minPolicyTermYears = minPolicyTermYears; }

    public Integer getMaxPolicyTermYears() { return maxPolicyTermYears; }
    public void setMaxPolicyTermYears(Integer maxPolicyTermYears) { this.maxPolicyTermYears = maxPolicyTermYears; }
}
