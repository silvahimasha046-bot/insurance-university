package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.PricingTableEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PricingTableRepository extends JpaRepository<PricingTableEntity, Long> {}
