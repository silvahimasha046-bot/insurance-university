package com.insuranceuniversity.backend.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.SessionLogEntity;
import com.insuranceuniversity.backend.repository.SessionLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/logs")
public class LogAdminController {

    private final SessionLogRepository repo;
    private final ObjectMapper objectMapper;

    public LogAdminController(SessionLogRepository repo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public Page<SessionLogEntity> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String sessionHash,
            @RequestParam(required = false) String userSegment,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return repo.search(from, to, eventType, sessionHash, userSegment, PageRequest.of(page, size));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String sessionHash,
            @RequestParam(required = false) String userSegment,
            @RequestParam(defaultValue = "csv") String format) {

        List<SessionLogEntity> logs = repo.searchAll(from, to, eventType, sessionHash, userSegment);

        if ("json".equalsIgnoreCase(format)) {
            List<Map<String, Object>> rows = logs.stream()
                    .map(this::toJsonRecord)
                    .collect(Collectors.toList());
            try {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"logs.json\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(objectMapper.writeValueAsBytes(rows));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Failed to serialize logs JSON export.", e);
            }
        }

        StringBuilder csv = new StringBuilder();
        csv.append("id,sessionHash,timestamp,eventType,userSegment,payloadJson\n");
        for (SessionLogEntity log : logs) {
            csv.append(escape(String.valueOf(log.getId()))).append(",")
               .append(escape(log.getSessionHash())).append(",")
               .append(escape(log.getTimestamp() != null ? log.getTimestamp().toString() : "")).append(",")
               .append(escape(log.getEventType())).append(",")
               .append(escape(log.getUserSegment())).append(",")
               .append(escape(log.getPayloadJson())).append("\n");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"logs.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String escape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private Map<String, Object> toJsonRecord(SessionLogEntity log) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", log.getId());
        row.put("sessionHash", log.getSessionHash());
        row.put("timestamp", log.getTimestamp());
        row.put("eventType", log.getEventType());
        row.put("userSegment", log.getUserSegment());
        row.put("payloadJson", log.getPayloadJson());
        return row;
    }
}
