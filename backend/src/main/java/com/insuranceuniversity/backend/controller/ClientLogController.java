package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.SessionLogEntity;
import com.insuranceuniversity.backend.repository.SessionLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;

@RestController
@RequestMapping("/api/logs")
public class ClientLogController {

    private final SessionLogRepository repo;

    public ClientLogController(SessionLogRepository repo) {
        this.repo = repo;
    }

    @PostMapping
    public ResponseEntity<Void> log(@RequestBody Map<String, Object> body) {
        SessionLogEntity log = new SessionLogEntity();

        String sessionId = (String) body.get("sessionId");
        log.setSessionHash(hashSha256(sessionId));

        String timestamp = (String) body.get("timestamp");
        log.setTimestamp(timestamp != null ? LocalDateTime.parse(timestamp.replace("Z", "")) : LocalDateTime.now());
        log.setEventType((String) body.get("eventType"));
        log.setUserSegment((String) body.get("userSegment"));

        Object payload = body.get("payloadJson");
        log.setPayloadJson(payload != null ? payload.toString() : null);

        repo.save(log);
        return ResponseEntity.ok().build();
    }

    private String hashSha256(String input) {
        if (input == null) return null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
