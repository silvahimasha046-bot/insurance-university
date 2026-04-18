package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.CustomerChatMessageEntity;
import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import com.insuranceuniversity.backend.repository.CustomerChatMessageRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class CustomerChatService {

    private static final Pattern NUMBER_PATTERN = Pattern.compile("(\\d{2,3}(?:,\\d{3})+|\\d{1,9})");

    private final CustomerSessionService customerSessionService;
    private final ChatOrchestrator chatOrchestrator;
    private final CustomerChatMessageRepository chatRepo;
    private final ObjectMapper objectMapper;

    public CustomerChatService(
            CustomerSessionService customerSessionService,
            ChatOrchestrator chatOrchestrator,
            CustomerChatMessageRepository chatRepo,
            ObjectMapper objectMapper
    ) {
        this.customerSessionService = customerSessionService;
        this.chatOrchestrator = chatOrchestrator;
        this.chatRepo = chatRepo;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> sendMessage(String sessionId, String message, String requesterEmail) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("message is required");
        }

        CustomerSessionEntity session = customerSessionService.getSession(sessionId);
        assertSessionAccess(session, requesterEmail);

        String normalizedMessage = message.trim();
        saveMessage(sessionId, "USER", normalizedMessage, null);

        Map<String, Object> currentAnswers = new HashMap<>(customerSessionService.getAnswersAsMap(sessionId));
        List<Map<String, String>> missingBefore = chatOrchestrator.missingCoreFields(currentAnswers);
        String focusedMissingKey = firstMissingKey(missingBefore);

        ChatExtractionResult extraction = chatOrchestrator.extractAnswers(normalizedMessage, currentAnswers);
        Map<String, Object> extractedAnswers = new HashMap<>(extraction.extractedAnswers());
        Map<String, Object> contextualPatch = inferFromCurrentQuestion(normalizedMessage, missingBefore, extractedAnswers);
        if (!contextualPatch.isEmpty()) {
            extractedAnswers.putAll(contextualPatch);
        }

        // Guardrail for short yes/no replies: always bind to the currently asked boolean field.
        if (isBooleanKey(focusedMissingKey) && !extractedAnswers.containsKey(focusedMissingKey)) {
            Boolean direct = parseYesNo(normalizedMessage.toLowerCase(Locale.ROOT));
            if (direct != null) {
                extractedAnswers.put(focusedMissingKey, direct);
            }
        }

        if (!extractedAnswers.isEmpty()) {
            customerSessionService.saveAnswers(sessionId, extractedAnswers);
            currentAnswers.putAll(extractedAnswers);
        }

        String lowerMessage = normalizedMessage.toLowerCase(Locale.ROOT);
        boolean policyListIntent = isPolicyListIntent(lowerMessage);

        List<Map<String, String>> missingFields = chatOrchestrator.missingCoreFields(currentAnswers);
        Map<String, Object> recommendation = null;
        String reply;

        if (missingFields.isEmpty()) {
            try {
                recommendation = customerSessionService.getRecommendations(sessionId);
                reply = buildRecommendationReply(recommendation);
            } catch (Exception ex) {
                reply = "I have your profile updates. I could not generate suitability results right now, but we can continue and retry in a moment.";
            }
        } else {
            if (policyListIntent) {
                reply = buildPolicyIntentFollowUp(missingFields, extractedAnswers);
            } else {
                reply = buildOpenConversationFollowUp(normalizedMessage, extractedAnswers, missingFields);
            }
        }

        Map<String, Object> replyMeta = new HashMap<>();
        replyMeta.put("extractedKeys", extractedAnswers.keySet());
        replyMeta.put("missingCount", missingFields.size());
        replyMeta.put("recommendationGenerated", recommendation != null);
        replyMeta.put("extractionMode", extraction.extractionMode());
        if (extraction.fallbackReason() != null && !extraction.fallbackReason().isBlank()) {
            replyMeta.put("fallbackReason", extraction.fallbackReason());
        }
        saveMessage(sessionId, "AGENT", reply, replyMeta);

        Map<String, Object> response = new HashMap<>();
        response.put("sessionId", sessionId);
        response.put("reply", reply);
        response.put("extractedAnswers", extractedAnswers);
        response.put("missingFields", missingFields);
        response.put("recommendation", recommendation);
        response.put("extractionMode", extraction.extractionMode());
        response.put("fallbackReason", extraction.fallbackReason());
        return response;
    }

    private String firstMissingKey(List<Map<String, String>> missingBefore) {
        if (missingBefore == null || missingBefore.isEmpty()) {
            return null;
        }
        return missingBefore.get(0).get("key");
    }

    private boolean isBooleanKey(String key) {
        return "tobaccoUse".equals(key)
                || "isPep".equals(key)
                || "hasCriminalHistory".equals(key);
    }

    private Map<String, Object> inferFromCurrentQuestion(
            String message,
            List<Map<String, String>> missingBefore,
            Map<String, Object> alreadyExtracted
    ) {
        Map<String, Object> patch = new HashMap<>();
        if (missingBefore == null || missingBefore.isEmpty()) {
            return patch;
        }

        String key = missingBefore.get(0).get("key");
        if (key == null || key.isBlank() || alreadyExtracted.containsKey(key)) {
            return patch;
        }

        String normalized = message == null ? "" : message.trim();
        if (normalized.isBlank()) {
            return patch;
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        switch (key) {
            case "occupation" -> {
                if (normalized.matches("(?i)^[a-z][a-z .&/()-]{1,79}$")) {
                    patch.put("occupation", normalized.replaceAll("\\s+", " "));
                }
            }
            case "educationLevel" -> {
                String mapped = mapEducationLevel(lower);
                if (mapped != null) {
                    patch.put("educationLevel", mapped);
                }
            }
            case "tobaccoUse" -> {
                Boolean value = parseYesNo(lower);
                if (value != null) {
                    patch.put("tobaccoUse", value);
                }
            }
            case "isPep" -> {
                Boolean value = parseYesNo(lower);
                if (value != null) {
                    patch.put("isPep", value);
                }
            }
            case "hasCriminalHistory" -> {
                Boolean value = parseYesNo(lower);
                if (value != null) {
                    patch.put("hasCriminalHistory", value);
                }
            }
            case "age" -> {
                Integer age = parseInteger(normalized);
                if (age != null && age >= 18 && age <= 80) {
                    patch.put("age", age);
                }
            }
            case "monthlyIncomeLkr" -> {
                Integer amount = parseInteger(normalized);
                if (amount != null && amount > 0) {
                    patch.put("monthlyIncomeLkr", amount);
                }
            }
            case "monthlyExpensesLkr" -> {
                Integer amount = parseInteger(normalized);
                if (amount != null && amount > 0) {
                    patch.put("monthlyExpensesLkr", amount);
                }
            }
            case "needsText" -> {
                if (normalized.length() >= 3) {
                    patch.put("needsText", normalized);
                }
            }
            default -> {
                // no-op
            }
        }
        return patch;
    }

    private Integer parseInteger(String text) {
        Matcher matcher = NUMBER_PATTERN.matcher(text);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Integer.parseInt(matcher.group(1).replace(",", ""));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Boolean parseYesNo(String lowerText) {
        if (containsAnyToken(lowerText, "yes", "y", "yep", "yeah", "true", "1")) {
            return true;
        }
        if (containsAnyToken(lowerText, "no", "n", "nope", "false", "0", "never", "none")) {
            return false;
        }
        return null;
    }

    private boolean containsAnyToken(String input, String... candidates) {
        if (input == null || input.isBlank()) {
            return false;
        }
        String[] tokens = input.toLowerCase(Locale.ROOT).split("[^a-z0-9]+");
        for (String token : tokens) {
            if (token.isBlank()) {
                continue;
            }
            for (String candidate : candidates) {
                if (candidate.equals(token)) {
                    return true;
                }
            }
        }
        return false;
    }

    private String mapEducationLevel(String lowerText) {
        if (lowerText.contains("postgrad") || lowerText.contains("postgraduate") || lowerText.contains("masters") || lowerText.contains("phd")) {
            return "Postgrad";
        }
        if (lowerText.contains("undergrad") || lowerText.contains("undergraduate") || lowerText.contains("bachelor")) {
            return "Undergrad";
        }
        if (lowerText.contains("college") || lowerText.contains("diploma")) {
            return "College";
        }
        if (lowerText.contains("high school") || lowerText.contains("a/l") || lowerText.contains("o/l")) {
            return "HighSchool";
        }
        if (lowerText.contains("elementary") || lowerText.contains("primary")) {
            return "Elementary";
        }
        return null;
    }

    public List<Map<String, Object>> getHistory(String sessionId, String requesterEmail) {
        CustomerSessionEntity session = customerSessionService.getSession(sessionId);
        assertSessionAccess(session, requesterEmail);

        List<CustomerChatMessageEntity> rows = chatRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, Object>> history = new ArrayList<>();
        for (CustomerChatMessageEntity row : rows) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", row.getId());
            item.put("role", row.getRole());
            item.put("message", row.getMessage());
            item.put("createdAt", row.getCreatedAt() == null ? null : row.getCreatedAt().toString());
            if (row.getMetadataJson() != null && !row.getMetadataJson().isBlank()) {
                try {
                    item.put("metadata", objectMapper.readValue(row.getMetadataJson(), new TypeReference<Map<String, Object>>() {}));
                } catch (JsonProcessingException ignored) {
                    item.put("metadata", Map.of());
                }
            }
            history.add(item);
        }
        return history;
    }

    private String buildRecommendationReply(Map<String, Object> recommendation) {
        Object productsRaw = recommendation.get("rankedProducts");
        if (!(productsRaw instanceof List<?> list) || list.isEmpty()) {
            return "I reviewed your profile and no suitable ranked policy is available yet. I can ask a few more clarifying questions.";
        }

        List<String> planNames = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> plan)) continue;
            Object name = plan.get("name");
            if (name instanceof String s && !s.isBlank()) {
                planNames.add(s);
            }
            if (planNames.size() == 3) break;
        }

        if (planNames.isEmpty()) {
            return "Great, I generated your policy suitability list. You can review all suitable options now.";
        }
        return "Great, I generated your policy suitability list. Leading options include: " + String.join(", ", planNames) + ".";
    }

    private String buildOpenConversationFollowUp(String message, Map<String, Object> extractedAnswers, List<Map<String, String>> missingFields) {
        Map<String, String> nextPrompt = missingFields.get(0);

        if (extractedAnswers.isEmpty()) {
            if (isGreetingOrSmallTalk(message.toLowerCase(Locale.ROOT))) {
                return "Happy to help. " + nextPrompt.get("question") + " You can answer in your own words.";
            }
            return "Got it. " + nextPrompt.get("question") + " You can answer in your own words.";
        }

        String capturedSummary = summarizeCapturedFields(extractedAnswers);
        return capturedSummary + " " + nextPrompt.get("question") + " Feel free to answer naturally.";
    }

    private String buildPolicyIntentFollowUp(List<Map<String, String>> missingFields, Map<String, Object> extractedAnswers) {
        String needed = missingFields.stream()
                .limit(3)
                .map(item -> humanizeField(item.get("key")))
                .collect(Collectors.joining(", "));

        String prefix = extractedAnswers.isEmpty()
                ? "Absolutely, I can list all suitable policies with suitability scores."
                : summarizeCapturedFields(extractedAnswers) + " I can list all suitable policies with suitability scores.";

        String nextQuestion = missingFields.get(0).get("question");
        return prefix + " To make that accurate, I still need: " + needed + ". " + nextQuestion;
    }

    private String summarizeCapturedFields(Map<String, Object> extractedAnswers) {
        if (extractedAnswers.isEmpty()) {
            return "";
        }

        String labels = extractedAnswers.keySet().stream()
                .map(this::humanizeField)
                .limit(3)
                .collect(Collectors.joining(", "));

        return "I captured your " + labels + ".";
    }

    private String humanizeField(String key) {
        if (key == null) return "details";
        return switch (key) {
            case "needsText" -> "insurance goal";
            case "age" -> "age";
            case "monthlyIncomeLkr" -> "monthly income";
            case "monthlyExpensesLkr" -> "monthly expenses";
            case "educationLevel" -> "education level";
            case "occupation" -> "occupation";
            case "tobaccoUse" -> "tobacco usage";
            case "isPep" -> "PEP status";
            case "hasCriminalHistory" -> "criminal/litigation status";
            default -> key;
        };
    }

    private boolean isPolicyListIntent(String lowerMessage) {
        return lowerMessage.contains("list policies")
                || lowerMessage.contains("all policies")
                || lowerMessage.contains("policy list")
                || lowerMessage.contains("show policies")
                || lowerMessage.contains("suitable policies")
                || lowerMessage.contains("suitability")
                || lowerMessage.contains("recommend policy")
                || lowerMessage.contains("recommendation");
    }

    private boolean isGreetingOrSmallTalk(String lowerMessage) {
        return lowerMessage.matches(".*\\b(hi|hello|hey|good morning|good evening|thanks|thank you|okay|ok)\\b.*");
    }

    private void saveMessage(String sessionId, String role, String message, Map<String, Object> metadata) {
        CustomerChatMessageEntity row = new CustomerChatMessageEntity();
        row.setSessionId(sessionId);
        row.setRole(role);
        row.setMessage(message);
        row.setCreatedAt(LocalDateTime.now());
        if (metadata != null && !metadata.isEmpty()) {
            try {
                row.setMetadataJson(objectMapper.writeValueAsString(metadata));
            } catch (JsonProcessingException ignored) {
                row.setMetadataJson("{}");
            }
        }
        chatRepo.save(row);
    }

    private void assertSessionAccess(CustomerSessionEntity session, String requesterEmail) {
        String owner = session.getUserEmail();
        if (owner == null || owner.isBlank()) {
            return;
        }
        if (requesterEmail == null || requesterEmail.isBlank() || !owner.equalsIgnoreCase(requesterEmail)) {
            throw new AccessDeniedException("Session access denied");
        }
    }
}