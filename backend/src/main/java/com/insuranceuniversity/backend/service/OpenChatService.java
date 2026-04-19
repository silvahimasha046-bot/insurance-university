package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.OpenChatMessage;
import com.insuranceuniversity.backend.repository.OpenChatMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class OpenChatService {

    private static final Logger logger = LoggerFactory.getLogger(OpenChatService.class);

    private final OpenChatMessageRepository messageRepository;
    private final ObjectMapper objectMapper;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @Value("${app.aiEngineUrl:http://localhost:8000}")
    private String aiEngineUrl;

    @Value("${app.open-chat.stream-timeout-ms:120000}")
    private long streamTimeoutMs;

    @Value("${app.open-chat.max-messages-per-session:200}")
    private int maxMessagesPerSession;

    public OpenChatService(OpenChatMessageRepository messageRepository, ObjectMapper objectMapper) {
        this.messageRepository = messageRepository;
        this.objectMapper = objectMapper;
    }

    // ---- Session management ------------------------------------------------

    public String createSession(String userId) {
        return UUID.randomUUID().toString();
    }

    public List<Map<String, Object>> getHistory(String sessionId) {
        List<OpenChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (OpenChatMessage msg : messages) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", msg.getId());
            entry.put("role", msg.getRole());
            entry.put("content", msg.getContent());
            entry.put("toolName", msg.getToolName());
            entry.put("createdAt", msg.getCreatedAt() != null ? msg.getCreatedAt().toString() : null);
            result.add(entry);
        }
        return result;
    }

    @Transactional
    public void deleteSession(String sessionId) {
        messageRepository.deleteBySessionId(sessionId);
    }

    // ---- Streaming chat ----------------------------------------------------

    public SseEmitter streamChat(String sessionId, String userId, String message) {
        SseEmitter emitter = new SseEmitter(streamTimeoutMs);

        // Persist the user message
        persistMessage(sessionId, userId, "USER", message, null, null, null, null);

        // Check message limit
        long count = messageRepository.countBySessionId(sessionId);
        if (count > maxMessagesPerSession) {
            try {
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"message\":\"Session message limit reached. Please start a new conversation.\"}"));
                emitter.complete();
            } catch (Exception e) {
                logger.warn("Failed to send limit error", e);
            }
            return emitter;
        }

        // Build conversation history from DB for context
        List<Map<String, Object>> history = buildConversationHistoryForAI(sessionId);

        executor.submit(() -> {
            StringBuilder fullResponse = new StringBuilder();
            try {
                // Call AI Engine /chat/stream via raw HTTP (reads SSE)
                String url = aiEngineUrl + "/chat/stream";
                Map<String, Object> requestBody = new LinkedHashMap<>();
                requestBody.put("sessionId", sessionId);
                requestBody.put("userId", userId != null ? userId : "anonymous");
                requestBody.put("message", message);
                requestBody.put("conversationHistory", history);

                String jsonBody = objectMapper.writeValueAsString(requestBody);

                HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout((int) streamTimeoutMs);

                conn.getOutputStream().write(jsonBody.getBytes(StandardCharsets.UTF_8));
                conn.getOutputStream().flush();

                int status = conn.getResponseCode();
                if (status != 200) {
                    String errBody = new String(conn.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                    logger.error("AI Engine returned {} for /chat/stream: {}", status, errBody);
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data("{\"message\":\"AI service error: " + status + "\"}"));
                    emitter.complete();
                    return;
                }

                InputStream inputStream = conn.getInputStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8));

                String line;
                String currentEvent = "token";
                int tokensUsed = 0;
                List<String> toolsInvoked = new ArrayList<>();

                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.substring(7).trim();
                        continue;
                    }
                    if (line.startsWith("data: ")) {
                        String data = line.substring(6);

                        // Forward the SSE event to the frontend
                        try {
                            emitter.send(SseEmitter.event().name(currentEvent).data(data));
                        } catch (Exception e) {
                            logger.debug("Client disconnected during SSE stream");
                            break;
                        }

                        // Collect full response for persistence
                        if ("token".equals(currentEvent)) {
                            try {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> tokenData = objectMapper.readValue(data, Map.class);
                                Object content = tokenData.get("content");
                                if (content != null) {
                                    fullResponse.append(content);
                                }
                            } catch (Exception ignored) {}
                        } else if ("tool_start".equals(currentEvent)) {
                            try {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> toolData = objectMapper.readValue(data, Map.class);
                                Object toolName = toolData.get("tool");
                                if (toolName != null) {
                                    toolsInvoked.add(toolName.toString());
                                }
                            } catch (Exception ignored) {}
                        } else if ("done".equals(currentEvent)) {
                            try {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> doneData = objectMapper.readValue(data, Map.class);
                                Object fr = doneData.get("fullResponse");
                                if (fr != null) {
                                    fullResponse.setLength(0);
                                    fullResponse.append(fr);
                                }
                                Object tu = doneData.get("tokensUsed");
                                if (tu instanceof Number) {
                                    tokensUsed = ((Number) tu).intValue();
                                }
                            } catch (Exception ignored) {}
                        }
                    }
                }

                reader.close();
                conn.disconnect();

                // Persist assistant response
                if (fullResponse.length() > 0) {
                    persistMessage(sessionId, userId, "ASSISTANT", fullResponse.toString(),
                            null, null, null, tokensUsed > 0 ? tokensUsed : null);
                }

                // Persist tool invocations
                for (String tool : toolsInvoked) {
                    persistMessage(sessionId, userId, "TOOL", null, tool, null, null, null);
                }

                emitter.complete();

            } catch (Exception e) {
                logger.error("Error streaming chat for session {}: {}", sessionId, e.getMessage(), e);
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data("{\"message\":\"Internal server error\"}"));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });

        emitter.onCompletion(() -> logger.debug("SSE stream completed for session {}", sessionId));
        emitter.onTimeout(() -> {
            logger.warn("SSE stream timed out for session {}", sessionId);
            emitter.complete();
        });
        emitter.onError(e -> logger.debug("SSE stream error for session {}: {}", sessionId, e.getMessage()));

        return emitter;
    }

    // ---- Non-streaming fallback -------------------------------------------

    public Map<String, Object> sendMessage(String sessionId, String userId, String message) {
        persistMessage(sessionId, userId, "USER", message, null, null, null, null);

        List<Map<String, Object>> history = buildConversationHistoryForAI(sessionId);

        try {
            String url = aiEngineUrl + "/chat/message";
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("sessionId", sessionId);
            requestBody.put("userId", userId != null ? userId : "anonymous");
            requestBody.put("message", message);
            requestBody.put("conversationHistory", history);

            String jsonBody = objectMapper.writeValueAsString(requestBody);

            HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout((int) streamTimeoutMs);

            conn.getOutputStream().write(jsonBody.getBytes(StandardCharsets.UTF_8));
            conn.getOutputStream().flush();

            int status = conn.getResponseCode();
            String body;
            if (status >= 200 && status < 300) {
                body = new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            } else {
                body = new String(conn.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                throw new RuntimeException("AI Engine returned " + status + ": " + body);
            }
            conn.disconnect();

            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(body, Map.class);

            // Persist assistant response
            Object reply = result.get("reply");
            if (reply != null) {
                Object tu = result.get("tokensUsed");
                persistMessage(sessionId, userId, "ASSISTANT", reply.toString(),
                        null, null, null, tu instanceof Number ? ((Number) tu).intValue() : null);
            }

            return result;

        } catch (Exception e) {
            logger.error("Error in non-streaming chat for session {}: {}", sessionId, e.getMessage(), e);
            return Map.of("error", "Failed to get response from AI service", "sessionId", sessionId);
        }
    }

    // ---- Helpers -----------------------------------------------------------

    private void persistMessage(String sessionId, String userId, String role, String content,
                                String toolName, String toolArgs, String toolResult, Integer tokensUsed) {
        try {
            OpenChatMessage msg = new OpenChatMessage();
            msg.setSessionId(sessionId);
            msg.setUserId(userId);
            msg.setRole(role);
            msg.setContent(content);
            msg.setToolName(toolName);
            msg.setToolArgs(toolArgs);
            msg.setToolResult(toolResult);
            msg.setTokensUsed(tokensUsed);
            msg.setCreatedAt(LocalDateTime.now());
            messageRepository.save(msg);
        } catch (Exception e) {
            logger.error("Failed to persist chat message for session {}: {}", sessionId, e.getMessage());
        }
    }

    private List<Map<String, Object>> buildConversationHistoryForAI(String sessionId) {
        List<OpenChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, Object>> history = new ArrayList<>();

        for (OpenChatMessage msg : messages) {
            if ("TOOL".equals(msg.getRole())) continue; // skip tool-meta rows

            Map<String, Object> entry = new LinkedHashMap<>();
            String role = msg.getRole();
            // Map to OpenAI-compatible roles
            if ("USER".equals(role)) {
                entry.put("role", "user");
            } else if ("ASSISTANT".equals(role)) {
                entry.put("role", "assistant");
            } else {
                continue;
            }
            entry.put("content", msg.getContent());
            history.add(entry);
        }

        // Limit to last N turns to avoid overflowing context
        int maxTurns = 40; // 20 user + 20 assistant
        if (history.size() > maxTurns) {
            history = history.subList(history.size() - maxTurns, history.size());
        }

        return history;
    }
}
