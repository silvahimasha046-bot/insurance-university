package com.insuranceuniversity.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "model_versions")
public class ModelVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String description;
    private String artifactId;
    private Long sourceDatasetId;
    private Integer rowsProcessed;
    private String trainingFormat;
    private boolean active;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getArtifactId() { return artifactId; }
    public void setArtifactId(String artifactId) { this.artifactId = artifactId; }
    public Long getSourceDatasetId() { return sourceDatasetId; }
    public void setSourceDatasetId(Long sourceDatasetId) { this.sourceDatasetId = sourceDatasetId; }
    public Integer getRowsProcessed() { return rowsProcessed; }
    public void setRowsProcessed(Integer rowsProcessed) { this.rowsProcessed = rowsProcessed; }
    public String getTrainingFormat() { return trainingFormat; }
    public void setTrainingFormat(String trainingFormat) { this.trainingFormat = trainingFormat; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
