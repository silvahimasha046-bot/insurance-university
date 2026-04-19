package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.service.OpenChatService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customer/open-chat")
public class OpenChatController {

    private final OpenChatService openChatService;

    public OpenChatController(OpenChatService openChatService) {
        this.openChatService = openChatService;
    }

    /** POST /api/customer/open-chat/sessions — create a new open-chat session */
    @PostMapping("/sessions")
    public ResponseEntity<Map<String, String>> createSession() {
        String userId = getAuthenticatedEmail();
        String sessionId = openChatService.createSession(userId);
        return ResponseEntity.ok(Map.of("sessionId", sessionId));
    }

    /** POST /api/customer/open-chat/stream — SSE streaming chat response */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestBody Map<String, Object> body) {
        String sessionId = body.get("sessionId") instanceof String s ? s : "";
        String message = body.get("message") instanceof String s ? s : "";

        if (sessionId.isBlank() || message.isBlank()) {
            SseEmitter emitter = new SseEmitter(0L);
            try {
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"message\":\"sessionId and message are required\"}"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        String userId = getAuthenticatedEmail();
        return openChatService.streamChat(sessionId, userId, message);
    }

    /** POST /api/customer/open-chat/message — non-streaming chat response */
    @PostMapping("/message")
    public ResponseEntity<Map<String, Object>> sendMessage(@RequestBody Map<String, Object> body) {
        String sessionId = body.get("sessionId") instanceof String s ? s : "";
        String message = body.get("message") instanceof String s ? s : "";

        if (sessionId.isBlank() || message.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "sessionId and message are required"));
        }

        String userId = getAuthenticatedEmail();
        Map<String, Object> result = openChatService.sendMessage(sessionId, userId, message);
        return ResponseEntity.ok(result);
    }

    /** GET /api/customer/open-chat/history/{sessionId} — conversation history */
    @GetMapping("/history/{sessionId}")
    public ResponseEntity<Map<String, Object>> getHistory(@PathVariable String sessionId) {
        List<Map<String, Object>> messages = openChatService.getHistory(sessionId);
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "messages", messages));
    }

    /** DELETE /api/customer/open-chat/sessions/{sessionId} — delete session */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, String>> deleteSession(@PathVariable String sessionId) {
        openChatService.deleteSession(sessionId);
        return ResponseEntity.ok(Map.of("message", "Session deleted"));
    }

    private String getAuthenticatedEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }
}
