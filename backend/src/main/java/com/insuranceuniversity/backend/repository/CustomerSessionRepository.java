package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerSessionRepository extends JpaRepository<CustomerSessionEntity, String> {

    /** Return sessions owned by the given user email, newest first. */
    List<CustomerSessionEntity> findByUserEmailOrderByCreatedAtDesc(String userEmail);
}
