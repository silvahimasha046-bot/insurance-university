package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.DatasetMetaEntity;
import com.insuranceuniversity.backend.entity.ModelVersionEntity;
import com.insuranceuniversity.backend.repository.DatasetMetaRepository;
import com.insuranceuniversity.backend.repository.ModelVersionRepository;
import com.insuranceuniversity.backend.service.AiEngineClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/training")
public class TrainingController {

    private static final String TRAINING_FORMAT_VERSION = "policy-recommendation-v2";
    private static final Set<String> REQUIRED_COLUMNS = Set.of(
            "product_code",
            "category_code",
            "subcategory_code",
            "policy_type",
            "eligibility",
            "outcome_score",
            "age",
            "smoker",
            "income",
            "monthlyexpenseslkr",
            "networthlkr",
            "conditions_count"
    );

    private final DatasetMetaRepository datasetRepo;
    private final ModelVersionRepository modelRepo;
    private final AiEngineClient aiEngineClient;

    @Value("${app.uploadsDir}")
    private String uploadsDir;

    public TrainingController(DatasetMetaRepository datasetRepo, ModelVersionRepository modelRepo,
                              AiEngineClient aiEngineClient) {
        this.datasetRepo = datasetRepo;
        this.modelRepo = modelRepo;
        this.aiEngineClient = aiEngineClient;
    }

    @PostMapping("/datasets")
    public ResponseEntity<?> uploadDataset(@RequestParam("file") MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(uploadsDir).toAbsolutePath();
        Files.createDirectories(uploadPath);

        String storedName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path dest = uploadPath.resolve(storedName);
        file.transferTo(dest.toFile());

        CsvHeaderValidation validation = validateCsvHeaders(dest);
        if (!validation.valid()) {
            Files.deleteIfExists(dest);
            return ResponseEntity.badRequest().body(Map.of(
                "message", validation.message(),
                "missingColumns", validation.missingColumns(),
                "requiredColumns", REQUIRED_COLUMNS
            ));
        }

        DatasetMetaEntity meta = new DatasetMetaEntity();
        meta.setOriginalFilename(file.getOriginalFilename());
        meta.setStoredPath(dest.toString());
        meta.setFileSize(file.getSize());
        meta.setFormatVersion(TRAINING_FORMAT_VERSION);
        meta.setTrainingGoal("prediction");

        DatasetMetaEntity saved = datasetRepo.save(meta);

        // Forward to AI engine for training
        Map<String, Object> trainResult = null;
        ModelVersionEntity createdModel = null;
        try {
            trainResult = aiEngineClient.train(file);
            createdModel = createModelVersionFromTrainResult(saved, trainResult);
            if (createdModel != null) {
                saved.setLatestModelArtifactId(createdModel.getArtifactId());
                saved = datasetRepo.save(saved);
            }
        } catch (Exception e) {
            // Training is best-effort; dataset is still saved
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("dataset", saved);
        response.put("trainResult", trainResult != null ? trainResult : Map.of("message", "AI engine training skipped"));
        if (createdModel != null) {
            response.put("model", createdModel);
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/datasets")
    public List<DatasetMetaEntity> listDatasets() {
        return datasetRepo.findAll().stream()
                .sorted(Comparator.comparing(DatasetMetaEntity::getUploadedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @PostMapping("/models")
    public ModelVersionEntity createModel(@RequestBody ModelVersionEntity model) {
        return modelRepo.save(model);
    }

    @GetMapping("/models")
    public List<ModelVersionEntity> listModels() {
        return modelRepo.findAll().stream()
                .sorted(Comparator.comparing(ModelVersionEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @PostMapping("/models/{id}/promote")
    public ResponseEntity<?> promoteModel(@PathVariable Long id) {
        return modelRepo.findById(id).map(model -> {
            if (model.getArtifactId() == null || model.getArtifactId().isBlank()) {
                return ResponseEntity.badRequest().build();
            }

            aiEngineClient.activateModel(model.getArtifactId());
            List<ModelVersionEntity> all = modelRepo.findAll();
            all.forEach(m -> m.setActive(m.getId().equals(id)));
            modelRepo.saveAll(all);
            return ResponseEntity.ok(all.stream().filter(m -> m.getId().equals(id)).findFirst().orElse(model));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/datasets/{id}/retrain")
    public ResponseEntity<?> retrainDataset(@PathVariable Long id) {
        return datasetRepo.findById(id).map(dataset -> {
            try {
                CsvHeaderValidation validation = validateCsvHeaders(Paths.get(dataset.getStoredPath()));
                if (!validation.valid()) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "message", validation.message(),
                            "missingColumns", validation.missingColumns(),
                            "requiredColumns", REQUIRED_COLUMNS
                    ));
                }

                Map<String, Object> trainResult = aiEngineClient.trainFromPath(
                        dataset.getStoredPath(), dataset.getOriginalFilename());
                ModelVersionEntity createdModel = createModelVersionFromTrainResult(dataset, trainResult);
                if (createdModel != null) {
                    dataset.setLatestModelArtifactId(createdModel.getArtifactId());
                    datasetRepo.save(dataset);
                }

                Map<String, Object> response = new LinkedHashMap<>();
                response.put("dataset", dataset);
                response.put("trainResult", trainResult);
                if (createdModel != null) {
                    response.put("model", createdModel);
                }
                return ResponseEntity.ok(response);
            } catch (Exception e) {
                return ResponseEntity.ok(Map.of("dataset", dataset,
                        "trainResult", Map.of("message", "AI engine training failed: " + e.getMessage())));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    private ModelVersionEntity createModelVersionFromTrainResult(DatasetMetaEntity dataset,
                                                                 Map<String, Object> trainResult) {
        if (trainResult == null) {
            return null;
        }

        String artifactId = asString(trainResult.get("modelArtifactId"));
        if (artifactId == null || artifactId.isBlank()) {
            return null;
        }

        ModelVersionEntity model = new ModelVersionEntity();
        String modelName = asString(trainResult.get("modelName"));
        model.setName(modelName != null && !modelName.isBlank() ? modelName : "Policy Outcome Model");
        model.setDescription("Trained from dataset: " + dataset.getOriginalFilename());
        model.setArtifactId(artifactId);
        model.setSourceDatasetId(dataset.getId());
        model.setRowsProcessed(asInteger(trainResult.get("rowsProcessed")));
        model.setTrainingFormat(asString(trainResult.get("trainingFormat")));
        model.setActive(false);
        return modelRepo.save(model);
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private CsvHeaderValidation validateCsvHeaders(Path csvPath) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(csvPath)) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                return new CsvHeaderValidation(false, List.of(),
                        "Invalid training CSV: header row is missing.");
            }

            Set<String> normalizedColumns = List.of(headerLine.split(",")).stream()
                    .map(this::normalizeHeader)
                    .collect(Collectors.toSet());

            List<String> missing = REQUIRED_COLUMNS.stream()
                    .filter(required -> !normalizedColumns.contains(required))
                    .sorted()
                    .toList();

            if (!missing.isEmpty()) {
                return new CsvHeaderValidation(
                        false,
                        missing,
                        "Invalid training CSV for policy-recommendation-v2: missing required header column(s)."
                );
            }

            return new CsvHeaderValidation(true, List.of(), "ok");
        }
    }

    private String normalizeHeader(String raw) {
        String clean = raw == null ? "" : raw.trim().replace("\uFEFF", "");
        if (clean.startsWith("\"") && clean.endsWith("\"") && clean.length() >= 2) {
            clean = clean.substring(1, clean.length() - 1);
        }
        return clean.trim().toLowerCase();
    }

    private record CsvHeaderValidation(boolean valid, List<String> missingColumns, String message) {}
}
