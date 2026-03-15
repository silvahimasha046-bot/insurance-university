package com.insuranceuniversity.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_logs")
public class SessionLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionHash;
    private LocalDateTime timestamp;
    private String eventType;
    private String userSegment;

    @Column(columnDefinition = "TEXT")
    private String payloadJson;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSessionHash() { return sessionHash; }
    public void setSessionHash(String sessionHash) { this.sessionHash = sessionHash; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getUserSegment() { return userSegment; }
    public void setUserSegment(String userSegment) { this.userSegment = userSegment; }
    public String getPayloadJson() { return payloadJson; }
    public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
}
