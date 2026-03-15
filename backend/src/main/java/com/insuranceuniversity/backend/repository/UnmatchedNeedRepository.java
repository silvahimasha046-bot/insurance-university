package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.UnmatchedNeedEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UnmatchedNeedRepository extends JpaRepository<UnmatchedNeedEntity, Long> {}
