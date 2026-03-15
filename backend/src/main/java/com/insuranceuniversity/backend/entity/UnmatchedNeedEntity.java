package com.insuranceuniversity.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "unmatched_needs")
public class UnmatchedNeedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String theme;
    private Integer occurrences;

    @Column(columnDefinition = "TEXT")
    private String sampleAnonymisedText;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public Integer getOccurrences() { return occurrences; }
    public void setOccurrences(Integer occurrences) { this.occurrences = occurrences; }
    public String getSampleAnonymisedText() { return sampleAnonymisedText; }
    public void setSampleAnonymisedText(String sampleAnonymisedText) { this.sampleAnonymisedText = sampleAnonymisedText; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
