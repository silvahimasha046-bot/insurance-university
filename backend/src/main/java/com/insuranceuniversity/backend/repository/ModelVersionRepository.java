package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.ModelVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ModelVersionRepository extends JpaRepository<ModelVersionEntity, Long> {}
