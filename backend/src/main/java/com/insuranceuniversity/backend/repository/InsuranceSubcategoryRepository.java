package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.InsuranceSubcategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InsuranceSubcategoryRepository extends JpaRepository<InsuranceSubcategoryEntity, Long> {
    Optional<InsuranceSubcategoryEntity> findByCodeIgnoreCase(String code);
    List<InsuranceSubcategoryEntity> findAllByOrderByDisplayOrderAscNameAsc();
    List<InsuranceSubcategoryEntity> findByCategoryIdOrderByDisplayOrderAscNameAsc(Long categoryId);
}