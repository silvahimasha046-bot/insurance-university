package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.OpenChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OpenChatMessageRepository extends JpaRepository<OpenChatMessage, Long> {

    List<OpenChatMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    List<OpenChatMessage> findByUserIdOrderByCreatedAtDesc(String userId);

    void deleteBySessionId(String sessionId);

    long countBySessionId(String sessionId);

    long countByUserId(String userId);
}
