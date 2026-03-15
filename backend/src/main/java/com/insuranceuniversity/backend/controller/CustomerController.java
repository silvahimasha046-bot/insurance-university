package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.CustomerAnswerEntity;
import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import com.insuranceuniversity.backend.service.CustomerSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customer")
public class CustomerController {

    private final CustomerSessionService customerSessionService;

    public CustomerController(CustomerSessionService customerSessionService) {
        this.customerSessionService = customerSessionService;
    }

    /** POST /api/customer/sessions — create a new session */
    @PostMapping("/sessions")
    public ResponseEntity<Map<String, String>> createSession() {
        String sessionId = customerSessionService.createSession();
        return ResponseEntity.ok(Map.of("sessionId", sessionId));
    }

    /** GET /api/customer/sessions/{sessionId} — retrieve session + answers */
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSession(@PathVariable String sessionId) {
        CustomerSessionEntity session = customerSessionService.getSession(sessionId);
        List<CustomerAnswerEntity> answers = customerSessionService.getAnswers(sessionId);

        Map<String, Object> response = Map.of(
                "sessionId", session.getId(),
                "status", session.getStatus(),
                "createdAt", session.getCreatedAt().toString(),
                "updatedAt", session.getUpdatedAt().toString(),
                "answers", answers.stream().map(a -> Map.of(
                        "key", a.getKey(),
                        "valueJson", a.getValueJson()
                )).toList()
        );
        return ResponseEntity.ok(response);
    }

    /** POST /api/customer/sessions/{sessionId}/answers — upsert answers */
    @PostMapping("/sessions/{sessionId}/answers")
    public ResponseEntity<Map<String, String>> saveAnswers(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> answers) {
        customerSessionService.saveAnswers(sessionId, answers);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /** POST /api/customer/sessions/{sessionId}/recommendations — get AI recommendations */
    @PostMapping("/sessions/{sessionId}/recommendations")
    public ResponseEntity<Map<String, Object>> getRecommendations(@PathVariable String sessionId) {
        Map<String, Object> result = customerSessionService.getRecommendations(sessionId);
        return ResponseEntity.ok(result);
    }
}
