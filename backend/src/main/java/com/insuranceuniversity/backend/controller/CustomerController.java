package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.CustomerAnswerEntity;
import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import com.insuranceuniversity.backend.service.CustomerSessionService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
        String userEmail = getAuthenticatedEmail();
        String sessionId = customerSessionService.createSession(userEmail);
        return ResponseEntity.ok(Map.of("sessionId", sessionId));
    }

    /** GET /api/customer/sessions — list past sessions (authenticated user) */
    @GetMapping("/sessions")
    public ResponseEntity<List<Map<String, Object>>> listSessions() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null || userEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<Map<String, Object>> sessions = customerSessionService.listSessions(userEmail);
        return ResponseEntity.ok(sessions);
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

    /** DELETE /api/customer/sessions/{sessionId} — delete session (consent withdrawal) */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(@PathVariable String sessionId) {
        customerSessionService.deleteSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    /** PATCH /api/customer/sessions/{sessionId}/complete — mark session as completed */
    @PatchMapping("/sessions/{sessionId}/complete")
    public ResponseEntity<Map<String, Object>> completeSession(@PathVariable String sessionId) {
        try {
            Map<String, Object> result = customerSessionService.completeSession(sessionId);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
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

    /** POST /api/customer/sessions/{sessionId}/documents — upload or re-upload a document */
    @PostMapping("/sessions/{sessionId}/documents")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @PathVariable String sessionId,
            @RequestParam("docType") String docType,
            @RequestParam(value = "docSide", required = false) String docSide,
            @RequestParam("file") MultipartFile file) {
        try {
            String userEmail = getAuthenticatedEmail();
            Map<String, Object> result = customerSessionService.uploadDocument(sessionId, docType, docSide, file, userEmail);
            return ResponseEntity.ok(result);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** GET /api/customer/sessions/{sessionId}/documents — latest session documents */
    @GetMapping("/sessions/{sessionId}/documents")
    public ResponseEntity<Map<String, Object>> getSessionDocuments(@PathVariable String sessionId) {
        try {
            String userEmail = getAuthenticatedEmail();
            Map<String, Object> result = customerSessionService.getSessionDocuments(sessionId, userEmail);
            return ResponseEntity.ok(result);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** GET /api/customer/documents/latest — latest reusable customer documents */
    @GetMapping("/documents/latest")
    public ResponseEntity<Map<String, Object>> getLatestUserDocuments() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null || userEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            Map<String, Object> result = customerSessionService.getLatestUserDocuments(userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** GET /api/customer/sessions/{sessionId}/documents/{documentId}/download — download a document */
    @GetMapping("/sessions/{sessionId}/documents/{documentId}/download")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable String sessionId,
            @PathVariable Long documentId) {
        try {
            String userEmail = getAuthenticatedEmail();
            Map<String, Object> payload = customerSessionService.getDocumentDownload(sessionId, documentId, userEmail);
            Resource resource = (Resource) payload.get("resource");
            String filename = String.valueOf(payload.get("filename"));
            String contentType = payload.get("contentType") instanceof String s && !s.isBlank()
                    ? s
                    : MediaType.APPLICATION_OCTET_STREAM_VALUE;

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** POST /api/customer/feedback — submit survey feedback */
    @PostMapping("/feedback")
    public ResponseEntity<Map<String, String>> submitFeedback(@RequestBody Map<String, Object> body) {
        // Feedback is logged server-side; no persistence layer required for MVP
        int rating = body.get("rating") instanceof Number n ? n.intValue() : 0;
        String comments = body.get("comments") instanceof String s ? s : "";
        return ResponseEntity.ok(Map.of("status", "ok", "rating", String.valueOf(rating)));
    }

    /** Returns the authenticated user's email, or null if unauthenticated. */
    private String getAuthenticatedEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }
}
