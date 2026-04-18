package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class LlmChatOrchestrator implements ChatOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(LlmChatOrchestrator.class);

    private static final String DEFAULT_BASE_URL = "https://api.openai.com/v1";
    private static final String DEFAULT_MODEL = "gpt-4o-mini";
    private static final int DEFAULT_TIMEOUT_MS = 3500;

    private static final Set<String> ALLOWED_EDUCATION = Set.of(
            "Postgrad",
            "Undergrad",
            "College",
            "HighSchool",
            "Elementary"
    );

    private static final String SYSTEM_PROMPT = """
            You extract insurance onboarding fields from a single user message.
            Return ONLY a compact JSON object.
            Allowed keys: needsText, age, monthlyIncomeLkr, monthlyExpensesLkr, occupation, educationLevel, tobaccoUse, isPep, hasCriminalHistory.
            Rules:
            - age: integer 18..80
            - monthlyIncomeLkr / monthlyExpensesLkr: positive integer
            - educationLevel must be one of: Postgrad, Undergrad, College, HighSchool, Elementary
            - tobaccoUse / isPep / hasCriminalHistory: boolean
            - occupation: short plain text role/title
            - needsText: concise phrase or sentence
            If unknown, omit the key.
            No markdown. No explanation.
            """;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final DeterministicChatOrchestrator deterministic;
    private final String apiKey;
    private final String model;

    public LlmChatOrchestrator(
            String baseUrl,
            String apiKey,
            String model,
            Integer timeoutMs,
            ObjectMapper objectMapper,
            DeterministicChatOrchestrator deterministic
    ) {
        String normalizedBaseUrl = normalizeBaseUrl(baseUrl);
        int effectiveTimeoutMs = timeoutMs == null || timeoutMs <= 0 ? DEFAULT_TIMEOUT_MS : timeoutMs;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(effectiveTimeoutMs);
        factory.setReadTimeout(effectiveTimeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(normalizedBaseUrl)
                .requestFactory(factory)
                .build();
        this.objectMapper = objectMapper;
        this.deterministic = deterministic;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = (model == null || model.isBlank()) ? DEFAULT_MODEL : model.trim();
    }

    @Override
    public ChatExtractionResult extractAnswers(String message, Map<String, Object> existingAnswers) {
        if (apiKey.isBlank()) {
            return deterministicFallback(message, existingAnswers, "llm_not_configured");
        }

        try {
            String prompt = buildPrompt(message, existingAnswers);
            Map<String, Object> body = Map.of(
                    "model", model,
                    "temperature", 0,
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", prompt)
                    )
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            String content = extractCompletionContent(response);
            if (content == null || content.isBlank()) {
                return deterministicFallback(message, existingAnswers, "llm_empty_content");
            }

            String json = extractJsonBlock(content);
            if (json == null || json.isBlank()) {
                return deterministicFallback(message, existingAnswers, "llm_non_json_content");
            }

            Map<String, Object> raw = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Map<String, Object> validated = validateAndNormalize(raw);

            if (validated.isEmpty()) {
                return deterministicFallback(message, existingAnswers, "llm_no_valid_fields");
            }
            return new ChatExtractionResult(validated, "llm", null);
        } catch (Exception ex) {
            log.warn("LLM extraction failed. Falling back to deterministic mode. reason={}", ex.getMessage());
            return deterministicFallback(message, existingAnswers, "llm_error");
        }
    }

    @Override
    public List<Map<String, String>> missingCoreFields(Map<String, Object> answers) {
        return deterministic.missingCoreFields(answers);
    }

    private ChatExtractionResult deterministicFallback(String message, Map<String, Object> existingAnswers, String reason) {
        ChatExtractionResult base = deterministic.extractAnswers(message, existingAnswers);
        return new ChatExtractionResult(base.extractedAnswers(), "deterministic_fallback", reason);
    }

    private String buildPrompt(String message, Map<String, Object> existingAnswers) {
        String existing;
        try {
            existing = objectMapper.writeValueAsString(existingAnswers == null ? Map.of() : existingAnswers);
        } catch (Exception ignored) {
            existing = "{}";
        }

        return "Existing accepted answers: " + existing + "\n"
                + "User message: " + message;
    }

    private String extractCompletionContent(Map<String, Object> response) {
        if (response == null) return null;
        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) return null;
        Object first = choices.get(0);
        if (!(first instanceof Map<?, ?> firstChoice)) return null;
        Object messageObj = firstChoice.get("message");
        if (!(messageObj instanceof Map<?, ?> messageMap)) return null;
        Object contentObj = messageMap.get("content");
        if (contentObj instanceof String content) {
            return content;
        }
        if (contentObj instanceof List<?> parts) {
            StringBuilder combined = new StringBuilder();
            for (Object part : parts) {
                if (!(part instanceof Map<?, ?> partMap)) continue;
                Object text = partMap.get("text");
                if (text instanceof String s) {
                    combined.append(s);
                }
            }
            return combined.toString();
        }
        return null;
    }

    private String extractJsonBlock(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline > -1 && lastFence > firstNewline) {
                trimmed = trimmed.substring(firstNewline + 1, lastFence).trim();
            }
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return null;
    }

    private Map<String, Object> validateAndNormalize(Map<String, Object> raw) {
        Map<String, Object> out = new HashMap<>();
        if (raw == null || raw.isEmpty()) {
            return out;
        }

        Integer age = toInteger(raw.get("age"));
        if (age != null && age >= 18 && age <= 80) {
            out.put("age", age);
        }

        Integer income = toInteger(raw.get("monthlyIncomeLkr"));
        if (income != null && income > 0) {
            out.put("monthlyIncomeLkr", income);
        }

        Integer expenses = toInteger(raw.get("monthlyExpensesLkr"));
        if (expenses != null && expenses > 0) {
            out.put("monthlyExpensesLkr", expenses);
        }

        String occupation = toCleanString(raw.get("occupation"), 2, 80);
        if (occupation != null) {
            out.put("occupation", occupation);
        }

        String needs = toCleanString(raw.get("needsText"), 3, 500);
        if (needs != null) {
            out.put("needsText", needs);
        }

        String education = toCleanString(raw.get("educationLevel"), 3, 20);
        if (education != null) {
            String normalizedEducation = normalizeEducation(education);
            if (normalizedEducation != null) {
                out.put("educationLevel", normalizedEducation);
            }
        }

        Boolean tobacco = toBoolean(raw.get("tobaccoUse"));
        if (tobacco != null) {
            out.put("tobaccoUse", tobacco);
        }

        Boolean pep = toBoolean(raw.get("isPep"));
        if (pep != null) {
            out.put("isPep", pep);
        }

        Boolean criminal = toBoolean(raw.get("hasCriminalHistory"));
        if (criminal != null) {
            out.put("hasCriminalHistory", criminal);
        }

        return out;
    }

    private Integer toInteger(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            String cleaned = s.replace(",", "").trim();
            if (cleaned.isEmpty()) return null;
            try {
                return Integer.parseInt(cleaned);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Boolean toBoolean(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof String s) {
            String lower = s.trim().toLowerCase(Locale.ROOT);
            if (Set.of("true", "yes", "y", "1").contains(lower)) return true;
            if (Set.of("false", "no", "n", "0").contains(lower)) return false;
        }
        return null;
    }

    private String toCleanString(Object value, int minLen, int maxLen) {
        if (!(value instanceof String s)) return null;
        String cleaned = s.trim().replaceAll("\\s+", " ");
        if (cleaned.length() < minLen || cleaned.length() > maxLen) {
            return null;
        }
        return cleaned;
    }

    private String normalizeEducation(String value) {
        for (String allowed : ALLOWED_EDUCATION) {
            if (allowed.equalsIgnoreCase(value)) {
                return allowed;
            }
        }
        return null;
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return DEFAULT_BASE_URL;
        }
        return baseUrl.trim().replaceAll("/+$", "");
    }
}
