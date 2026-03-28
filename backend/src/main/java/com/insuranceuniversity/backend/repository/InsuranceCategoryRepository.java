package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.InsuranceCategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InsuranceCategoryRepository extends JpaRepository<InsuranceCategoryEntity, Long> {
    Optional<InsuranceCategoryEntity> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    List<InsuranceCategoryEntity> findAllByOrderByDisplayOrderAscNameAsc();
}