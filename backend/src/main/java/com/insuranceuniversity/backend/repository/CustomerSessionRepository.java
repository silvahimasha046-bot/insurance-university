package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerSessionRepository extends JpaRepository<CustomerSessionEntity, String> {
}
