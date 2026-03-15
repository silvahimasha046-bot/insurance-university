package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.RecommendationRunEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecommendationRunRepository extends JpaRepository<RecommendationRunEntity, Long> {
    List<RecommendationRunEntity> findBySessionIdOrderByCreatedAtDesc(String sessionId);
}
