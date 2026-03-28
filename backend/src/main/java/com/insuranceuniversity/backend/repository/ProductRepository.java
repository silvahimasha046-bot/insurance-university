package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.ProductEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductRepository extends JpaRepository<ProductEntity, Long> {
	List<ProductEntity> findByCategoryId(Long categoryId);
	List<ProductEntity> findBySubcategoryId(Long subcategoryId);
	List<ProductEntity> findByCategoryIdAndSubcategoryId(Long categoryId, Long subcategoryId);
}
