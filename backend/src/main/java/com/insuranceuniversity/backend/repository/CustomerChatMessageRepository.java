package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.CustomerChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerChatMessageRepository extends JpaRepository<CustomerChatMessageEntity, Long> {

    List<CustomerChatMessageEntity> findBySessionIdOrderByCreatedAtAsc(String sessionId);
}