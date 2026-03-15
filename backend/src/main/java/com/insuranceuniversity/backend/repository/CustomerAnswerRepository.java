package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.CustomerAnswerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerAnswerRepository extends JpaRepository<CustomerAnswerEntity, Long> {
    List<CustomerAnswerEntity> findBySessionId(String sessionId);
    void deleteBySessionIdAndKey(String sessionId, String key);
}
