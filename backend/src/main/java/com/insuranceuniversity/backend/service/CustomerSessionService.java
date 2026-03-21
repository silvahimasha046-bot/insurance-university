package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.CustomerAnswerEntity;
import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import com.insuranceuniversity.backend.entity.EligibilityRuleEntity;
import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.entity.RecommendationRunEntity;
import com.insuranceuniversity.backend.entity.SessionLogEntity;
import com.insuranceuniversity.backend.repository.CustomerAnswerRepository;
import com.insuranceuniversity.backend.repository.CustomerSessionRepository;
import com.insuranceuniversity.backend.repository.EligibilityRuleRepository;
import com.insuranceuniversity.backend.repository.RecommendationRunRepository;
import com.insuranceuniversity.backend.repository.SessionLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CustomerSessionService {

    private static final Logger log = LoggerFactory.getLogger(CustomerSessionService.class);

    private final CustomerSessionRepository sessionRepo;
    private final CustomerAnswerRepository answerRepo;
    private final RecommendationRunRepository runRepo;
    private final SessionLogRepository sessionLogRepo;
    private final ProductService productService;
    private final AiEngineClient aiEngineClient;
    private final EligibilityRuleRepository eligibilityRuleRepo;
    private final ObjectMapper objectMapper;

    public CustomerSessionService(
            CustomerSessionRepository sessionRepo,
            CustomerAnswerRepository answerRepo,
            RecommendationRunRepository runRepo,
            SessionLogRepository sessionLogRepo,
            ProductService productService,
            AiEngineClient aiEngineClient,
            EligibilityRuleRepository eligibilityRuleRepo,
            ObjectMapper objectMapper) {
        this.sessionRepo = sessionRepo;
        this.answerRepo = answerRepo;
        this.runRepo = runRepo;
        this.sessionLogRepo = sessionLogRepo;
        this.productService = productService;
        this.aiEngineClient = aiEngineClient;
        this.eligibilityRuleRepo = eligibilityRuleRepo;
        this.objectMapper = objectMapper;
    }

    /** Create a new customer session and return its id. */
    public String createSession() {
        CustomerSessionEntity entity = new CustomerSessionEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setStatus("ACTIVE");
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(entity);
        writeSessionLog(entity.getId(), "SESSION_CREATED", null);
        return entity.getId();
    }

    /** List recent sessions (for authenticated user view). */
    public List<Map<String, Object>> listSessions() {
        return sessionRepo.findAll().stream()
                .sorted(java.util.Comparator.comparing(CustomerSessionEntity::getCreatedAt).reversed())
                .limit(50)
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sessionId", s.getId());
                    m.put("status", s.getStatus());
                    m.put("createdAt", s.getCreatedAt().toString());
                    m.put("updatedAt", s.getUpdatedAt().toString());
                    return m;
                })
                .collect(Collectors.toList());
    }

    /** Retrieve session by id or throw. */
    public CustomerSessionEntity getSession(String sessionId) {
        return sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
    }

    /** Delete a session and all its answers (consent withdrawal). */
    @Transactional
    public void deleteSession(String sessionId) {
        if (!sessionRepo.existsById(sessionId)) return;
        // Write log before deletion so there is no FK concern
        writeSessionLog(sessionId, "SESSION_DELETED", "consent_withdrawn");
        answerRepo.deleteBySessionId(sessionId);
        sessionRepo.deleteById(sessionId);
    }

    /** Retrieve all stored answers for a session. */
    public List<CustomerAnswerEntity> getAnswers(String sessionId) {
        return answerRepo.findBySessionId(sessionId);
    }

    /** Upsert a batch of answers (key→value pairs) for a session. */
    @Transactional
    public void saveAnswers(String sessionId, Map<String, Object> answers) {
        // Ensure session exists
        getSession(sessionId);

        for (Map.Entry<String, Object> entry : answers.entrySet()) {
            // Remove existing answer with same key before inserting
            answerRepo.deleteBySessionIdAndKey(sessionId, entry.getKey());

            CustomerAnswerEntity ans = new CustomerAnswerEntity();
            ans.setSessionId(sessionId);
            ans.setKey(entry.getKey());
            try {
                ans.setValueJson(objectMapper.writeValueAsString(entry.getValue()));
            } catch (JsonProcessingException e) {
                ans.setValueJson(String.valueOf(entry.getValue()));
            }
            ans.setCreatedAt(LocalDateTime.now());
            answerRepo.save(ans);
        }

        writeSessionLog(sessionId, "ANSWERS_SUBMITTED", answers.keySet().toString());
    }

    /** Build features from stored answers, call AI engine, persist run, return response. */
    @Transactional
    public Map<String, Object> getRecommendations(String sessionId) {
        getSession(sessionId);

        // Build feature map from stored answers
        Map<String, Object> features = buildFeatures(sessionId);

        // Load products and apply eligibility rules
        List<ProductEntity> products = productService.listProducts();
        List<ProductEntity> eligibleProducts = applyEligibilityRules(products, features);
        List<Map<String, Object>> productMaps = eligibleProducts.stream()
                .map(this::toProductMap)
                .collect(Collectors.toList());

        // Serialize request for audit
        String requestJson;
        try {
            Map<String, Object> reqData = new HashMap<>();
            reqData.put("sessionId", sessionId);
            reqData.put("features", features);
            reqData.put("products", productMaps);
            requestJson = objectMapper.writeValueAsString(reqData);
        } catch (JsonProcessingException e) {
            requestJson = "{}";
        }

        // Call AI engine
        Map<String, Object> aiResponse = aiEngineClient.score(sessionId, features, productMaps);

        // Persist run
        String responseJson;
        try {
            responseJson = objectMapper.writeValueAsString(aiResponse);
        } catch (JsonProcessingException e) {
            responseJson = "{}";
        }

        RecommendationRunEntity run = new RecommendationRunEntity();
        run.setSessionId(sessionId);
        run.setRequestJson(requestJson);
        run.setResponseJson(responseJson);
        run.setCreatedAt(LocalDateTime.now());
        runRepo.save(run);

        writeSessionLog(sessionId, "RECOMMENDATIONS_FETCHED", null);
        return aiResponse;
    }

    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------

    /**
     * Apply active eligibility rules to filter out ineligible products.
     * Rules are JSON objects with optional fields: minAge, maxAge, smokerAllowed (bool).
     */
    private List<ProductEntity> applyEligibilityRules(List<ProductEntity> products,
                                                       Map<String, Object> features) {
        List<EligibilityRuleEntity> rules = eligibilityRuleRepo.findAll();
        if (rules.isEmpty()) return products;

        int age = 0;
        if (features.get("age") instanceof Number n) age = n.intValue();

        boolean smoker = false;
        if (features.get("smoker") instanceof Boolean b) smoker = b;

        final int userAge = age;
        final boolean userSmoker = smoker;

        return products.stream().filter(p -> {
            for (EligibilityRuleEntity rule : rules) {
                try {
                    if (rule.getRuleJson() == null || rule.getRuleJson().isBlank()) continue;
                    @SuppressWarnings("unchecked")
                    Map<String, Object> ruleMap = objectMapper.readValue(rule.getRuleJson(), Map.class);

                    // Check age constraints
                    if (ruleMap.get("minAge") instanceof Number minAge && userAge > 0
                            && userAge < minAge.intValue()) {
                        return false;
                    }
                    if (ruleMap.get("maxAge") instanceof Number maxAge && userAge > 0
                            && userAge > maxAge.intValue()) {
                        return false;
                    }
                    // Check smoker constraint
                    if (ruleMap.get("smokerAllowed") instanceof Boolean smokerAllowed
                            && !smokerAllowed && userSmoker) {
                        return false;
                    }
                } catch (JsonProcessingException e) {
                    log.warn("Could not parse rule JSON for rule id={}: {}", rule.getId(), e.getMessage());
                }
            }
            return true;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> buildFeatures(String sessionId) {
        List<CustomerAnswerEntity> answers = answerRepo.findBySessionId(sessionId);
        Map<String, Object> features = new HashMap<>();
        for (CustomerAnswerEntity ans : answers) {
            try {
                Object value = objectMapper.readValue(ans.getValueJson(), Object.class);
                features.put(ans.getKey(), value);
            } catch (JsonProcessingException e) {
                features.put(ans.getKey(), ans.getValueJson());
            }
        }
        return features;
    }

    private Map<String, Object> toProductMap(ProductEntity p) {
        Map<String, Object> m = new HashMap<>();
        m.put("code", p.getCode());
        m.put("name", p.getName());
        m.put("basePremium", p.getBasePremium());
        if (p.getTagsJson() != null && !p.getTagsJson().isBlank()) {
            try {
                List<String> tags = objectMapper.readValue(p.getTagsJson(), new TypeReference<>() {});
                m.put("tags", tags);
            } catch (JsonProcessingException e) {
                m.put("tags", List.of());
            }
        } else {
            m.put("tags", List.of());
        }
        return m;
    }

    private void writeSessionLog(String sessionId, String eventType, String detail) {
        try {
            SessionLogEntity log = new SessionLogEntity();
            log.setSessionHash(hashSessionId(sessionId));
            log.setTimestamp(LocalDateTime.now());
            log.setEventType(eventType);
            log.setUserSegment("CUSTOMER");
            if (detail != null) {
                Map<String, String> payload = Map.of("detail", detail);
                log.setPayloadJson(objectMapper.writeValueAsString(payload));
            }
            sessionLogRepo.save(log);
        } catch (Exception e) {
            // Non-critical; don't fail the main operation
            CustomerSessionService.log.warn("Failed to write session log for sessionId={}: {}", sessionId, e.getMessage());
        }
    }

    private String hashSessionId(String sessionId) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(sessionId.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return sessionId.substring(0, Math.min(16, sessionId.length()));
        }
    }
}
