package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.DatasetMetaEntity;
import com.insuranceuniversity.backend.entity.ModelVersionEntity;
import com.insuranceuniversity.backend.repository.DatasetMetaRepository;
import com.insuranceuniversity.backend.repository.ModelVersionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/training")
public class TrainingController {

    private final DatasetMetaRepository datasetRepo;
    private final ModelVersionRepository modelRepo;

    @Value("${app.uploadsDir}")
    private String uploadsDir;

    public TrainingController(DatasetMetaRepository datasetRepo, ModelVersionRepository modelRepo) {
        this.datasetRepo = datasetRepo;
        this.modelRepo = modelRepo;
    }

    @PostMapping("/datasets")
    public ResponseEntity<?> uploadDataset(@RequestParam("file") MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(uploadsDir).toAbsolutePath();
        Files.createDirectories(uploadPath);

        String storedName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path dest = uploadPath.resolve(storedName);
        file.transferTo(dest.toFile());

        DatasetMetaEntity meta = new DatasetMetaEntity();
        meta.setOriginalFilename(file.getOriginalFilename());
        meta.setStoredPath(dest.toString());
        meta.setFileSize(file.getSize());

        return ResponseEntity.ok(datasetRepo.save(meta));
    }

    @GetMapping("/datasets")
    public List<DatasetMetaEntity> listDatasets() {
        return datasetRepo.findAll();
    }

    @PostMapping("/models")
    public ModelVersionEntity createModel(@RequestBody ModelVersionEntity model) {
        return modelRepo.save(model);
    }

    @GetMapping("/models")
    public List<ModelVersionEntity> listModels() {
        return modelRepo.findAll();
    }

    @PostMapping("/models/{id}/promote")
    public ResponseEntity<ModelVersionEntity> promoteModel(@PathVariable Long id) {
        return modelRepo.findById(id).map(model -> {
            List<ModelVersionEntity> all = modelRepo.findAll();
            all.forEach(m -> m.setActive(m.getId().equals(id)));
            modelRepo.saveAll(all);
            return ResponseEntity.ok(all.stream().filter(m -> m.getId().equals(id)).findFirst().orElse(model));
        }).orElse(ResponseEntity.notFound().build());
    }
}
