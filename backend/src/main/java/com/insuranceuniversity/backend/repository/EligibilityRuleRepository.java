package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.EligibilityRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EligibilityRuleRepository extends JpaRepository<EligibilityRuleEntity, Long> {}
