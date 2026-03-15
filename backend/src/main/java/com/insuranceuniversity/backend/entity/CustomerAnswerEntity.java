package com.insuranceuniversity.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "customer_answers")
public class CustomerAnswerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionId;

    @Column(name = "`key`")
    private String key;

    @Column(columnDefinition = "TEXT")
    private String valueJson;

    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getValueJson() { return valueJson; }
    public void setValueJson(String valueJson) { this.valueJson = valueJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
