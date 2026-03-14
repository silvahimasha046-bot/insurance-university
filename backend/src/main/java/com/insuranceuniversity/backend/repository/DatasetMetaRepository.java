package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.DatasetMetaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DatasetMetaRepository extends JpaRepository<DatasetMetaEntity, Long> {}
