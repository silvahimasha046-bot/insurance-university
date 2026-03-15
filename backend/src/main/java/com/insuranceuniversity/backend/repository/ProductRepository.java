package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.ProductEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<ProductEntity, Long> {
}
