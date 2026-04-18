package com.insuranceuniversity.backend.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DeterministicChatOrchestrator implements ChatOrchestrator {

    private static final Pattern AGE_PATTERN = Pattern.compile("(?i)(?:age\\s*(?:is|:)\\s*|i\\s*am\\s*|i'm\\s*)(\\d{2})|\\b(\\d{2})\\s*(?:years?|yrs?)\\b");
    private static final Pattern MONEY_PATTERN = Pattern.compile("(\\d{2,3}(?:,\\d{3})+|\\d{4,9})");
    private static final Pattern OCCUPATION_PATTERN = Pattern.compile("(?i)\\b(?:i\\s*am|i'm|occupation\\s*(?:is|:))\\s+(?:a|an)?\\s*([a-z][a-z\\s]{2,40})");

    @Override
    public ChatExtractionResult extractAnswers(String message, Map<String, Object> existingAnswers) {
        Map<String, Object> patch = new HashMap<>();
        String normalized = message == null ? "" : message.trim();
        String lower = normalized.toLowerCase(Locale.ROOT);

        if (!normalized.isBlank()) {
            String priorNeeds = toText(existingAnswers.get("needsText"));
            if (priorNeeds == null || priorNeeds.isBlank()) {
                patch.put("needsText", normalized);
            }
        }

        Integer age = extractAge(normalized);
        if (age != null) {
            patch.put("age", age);
        }

        Integer income = extractMoneyValue(lower, "income", "salary", "earn", "monthly income");
        if (income != null) {
            patch.put("monthlyIncomeLkr", income);
        }

        Integer expenses = extractMoneyValue(lower, "expense", "spend", "monthly expenses");
        if (expenses != null) {
            patch.put("monthlyExpensesLkr", expenses);
        }

        String occupation = extractOccupation(normalized);
        if (occupation != null && !occupation.isBlank()) {
            patch.put("occupation", occupation);
        }

        String education = extractEducationLevel(lower);
        if (education != null) {
            patch.put("educationLevel", education);
        }

        Boolean tobaccoUse = extractTobaccoUse(lower);
        if (tobaccoUse != null) {
            patch.put("tobaccoUse", tobaccoUse);
        }

        Boolean pep = extractBooleanFact(lower, "pep", "politically exposed");
        if (pep != null) {
            patch.put("isPep", pep);
        }

        Boolean criminal = extractBooleanFact(lower, "criminal", "convicted", "litigation");
        if (criminal != null) {
            patch.put("hasCriminalHistory", criminal);
        }

        return new ChatExtractionResult(patch, "deterministic", null);
    }

    @Override
    public List<Map<String, String>> missingCoreFields(Map<String, Object> answers) {
        List<Map<String, String>> missing = new ArrayList<>();

        putMissingQuestion(missing, answers, "needsText", "What is your main insurance goal? For example family protection, retirement, or education funding.");
        putMissingQuestion(missing, answers, "age", "What is your age in years?");
        putMissingQuestion(missing, answers, "monthlyIncomeLkr", "What is your approximate monthly income in LKR?");
        putMissingQuestion(missing, answers, "monthlyExpensesLkr", "What are your monthly expenses in LKR?");
        putMissingQuestion(missing, answers, "educationLevel", "What is your highest education level? Postgrad, Undergrad, College, HighSchool, or Elementary.");
        putMissingQuestion(missing, answers, "occupation", "What is your occupation?");
        putMissingQuestion(missing, answers, "tobaccoUse", "Do you use tobacco? Please answer yes or no.");
        putMissingQuestion(missing, answers, "isPep", "Are you a politically exposed person (PEP) or related to one? yes or no.");
        putMissingQuestion(missing, answers, "hasCriminalHistory", "Do you have any criminal conviction or pending litigation? yes or no.");

        return missing;
    }

    private void putMissingQuestion(List<Map<String, String>> missing, Map<String, Object> answers, String key, String question) {
        Object value = answers.get(key);
        if (value == null) {
            missing.add(Map.of("key", key, "question", question));
            return;
        }
        if (value instanceof String str && str.isBlank()) {
            missing.add(Map.of("key", key, "question", question));
        }
    }

    private Integer extractAge(String message) {
        Matcher matcher = AGE_PATTERN.matcher(message);
        while (matcher.find()) {
            String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            if (raw == null) continue;
            int age = Integer.parseInt(raw);
            if (age >= 18 && age <= 80) {
                return age;
            }
        }
        return null;
    }

    private Integer extractMoneyValue(String lowerMessage, String... cues) {
        boolean cueMatch = false;
        for (String cue : cues) {
            if (lowerMessage.contains(cue)) {
                cueMatch = true;
                break;
            }
        }
        if (!cueMatch) return null;

        Matcher matcher = MONEY_PATTERN.matcher(lowerMessage);
        if (matcher.find()) {
            String value = Objects.requireNonNull(matcher.group()).replace(",", "");
            try {
                int parsed = Integer.parseInt(value);
                if (parsed > 0) return parsed;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String extractOccupation(String message) {
        Matcher matcher = OCCUPATION_PATTERN.matcher(message);
        if (!matcher.find()) {
            return null;
        }
        String occupation = matcher.group(1);
        if (occupation == null) return null;
        return occupation.trim().replaceAll("\\s+", " ");
    }

    private String extractEducationLevel(String lowerMessage) {
        if (lowerMessage.contains("postgrad") || lowerMessage.contains("postgraduate") || lowerMessage.contains("masters") || lowerMessage.contains("phd")) {
            return "Postgrad";
        }
        if (lowerMessage.contains("undergrad") || lowerMessage.contains("undergraduate") || lowerMessage.contains("bachelor")) {
            return "Undergrad";
        }
        if (lowerMessage.contains("college") || lowerMessage.contains("diploma")) {
            return "College";
        }
        if (lowerMessage.contains("high school") || lowerMessage.contains("a/l") || lowerMessage.contains("o/l")) {
            return "HighSchool";
        }
        if (lowerMessage.contains("elementary") || lowerMessage.contains("primary school")) {
            return "Elementary";
        }
        return null;
    }

    private Boolean extractTobaccoUse(String lowerMessage) {
        if (lowerMessage.contains("non smoker") || lowerMessage.contains("non-smoker") || lowerMessage.contains("do not smoke") || lowerMessage.contains("don't smoke") || lowerMessage.contains("no tobacco")) {
            return false;
        }
        if (lowerMessage.contains("smoker") || lowerMessage.contains("smoke") || lowerMessage.contains("tobacco")) {
            return true;
        }
        return null;
    }

    private Boolean extractBooleanFact(String lowerMessage, String... cues) {
        boolean cueMatch = false;
        for (String cue : cues) {
            if (lowerMessage.contains(cue)) {
                cueMatch = true;
                break;
            }
        }
        if (!cueMatch) return null;

        if (lowerMessage.contains("not") || lowerMessage.contains("no") || lowerMessage.contains("none") || lowerMessage.contains("never")) {
            return false;
        }
        if (lowerMessage.contains("yes") || lowerMessage.contains("have") || lowerMessage.contains("am") || lowerMessage.contains("is")) {
            return true;
        }
        return null;
    }

    private String toText(Object value) {
        return value instanceof String s ? s : null;
    }
}
