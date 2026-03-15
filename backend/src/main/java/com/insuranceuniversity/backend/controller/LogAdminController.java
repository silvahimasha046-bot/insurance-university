package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.SessionLogEntity;
import com.insuranceuniversity.backend.repository.SessionLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/logs")
public class LogAdminController {

    private final SessionLogRepository repo;

    public LogAdminController(SessionLogRepository repo) {
        this.repo = repo;
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
            StringBuilder sb = new StringBuilder();
            for (SessionLogEntity log : logs) {
                sb.append(toJsonLine(log)).append("\n");
            }
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"logs.jsonl\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(sb.toString().getBytes());
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
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.toString().getBytes());
    }

    private String escape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String toJsonLine(SessionLogEntity log) {
        return "{\"id\":" + log.getId() +
               ",\"sessionHash\":\"" + nullSafe(log.getSessionHash()) + "\"" +
               ",\"timestamp\":\"" + (log.getTimestamp() != null ? log.getTimestamp().toString() : "") + "\"" +
               ",\"eventType\":\"" + nullSafe(log.getEventType()) + "\"" +
               ",\"userSegment\":\"" + nullSafe(log.getUserSegment()) + "\"" +
               ",\"payloadJson\":" + (log.getPayloadJson() != null ? log.getPayloadJson() : "null") + "}";
    }

    private String nullSafe(String s) {
        return s != null ? s : "";
    }
}
