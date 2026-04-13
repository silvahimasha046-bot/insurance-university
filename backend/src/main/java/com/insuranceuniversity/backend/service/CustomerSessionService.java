package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.entity.CustomerAnswerEntity;
import com.insuranceuniversity.backend.entity.CustomerDocumentEntity;
import com.insuranceuniversity.backend.entity.CustomerSessionEntity;
import com.insuranceuniversity.backend.entity.EligibilityRuleEntity;
import com.insuranceuniversity.backend.entity.ProductEntity;
import com.insuranceuniversity.backend.entity.RecommendationRunEntity;
import com.insuranceuniversity.backend.entity.SessionLogEntity;
import com.insuranceuniversity.backend.repository.CustomerAnswerRepository;
import com.insuranceuniversity.backend.repository.CustomerDocumentRepository;
import com.insuranceuniversity.backend.repository.CustomerSessionRepository;
import com.insuranceuniversity.backend.repository.EligibilityRuleRepository;
import com.insuranceuniversity.backend.repository.RecommendationRunRepository;
import com.insuranceuniversity.backend.repository.SessionLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CustomerSessionService {

    private static final Logger log = LoggerFactory.getLogger(CustomerSessionService.class);

    private final CustomerSessionRepository sessionRepo;
    private final CustomerAnswerRepository answerRepo;
    private final CustomerDocumentRepository documentRepo;
    private final RecommendationRunRepository runRepo;
    private final SessionLogRepository sessionLogRepo;
    private final ProductService productService;
    private final AiEngineClient aiEngineClient;
    private final EligibilityRuleRepository eligibilityRuleRepo;
    private final ObjectMapper objectMapper;

    @Value("${app.premium.taxRate:0.0}")
    private double premiumTaxRate;

    @Value("${app.uploadsDir}")
    private String uploadsDir;

    public CustomerSessionService(
            CustomerSessionRepository sessionRepo,
            CustomerAnswerRepository answerRepo,
            CustomerDocumentRepository documentRepo,
            RecommendationRunRepository runRepo,
            SessionLogRepository sessionLogRepo,
            ProductService productService,
            AiEngineClient aiEngineClient,
            EligibilityRuleRepository eligibilityRuleRepo,
            ObjectMapper objectMapper) {
        this.sessionRepo = sessionRepo;
        this.answerRepo = answerRepo;
        this.documentRepo = documentRepo;
        this.runRepo = runRepo;
        this.sessionLogRepo = sessionLogRepo;
        this.productService = productService;
        this.aiEngineClient = aiEngineClient;
        this.eligibilityRuleRepo = eligibilityRuleRepo;
        this.objectMapper = objectMapper;
    }

    /** Create a new customer session and return its id. */
    public String createSession(String userEmail) {
        CustomerSessionEntity entity = new CustomerSessionEntity();
        entity.setId(UUID.randomUUID().toString());
        entity.setStatus("ACTIVE");
        if (userEmail != null && !userEmail.isBlank()) {
            entity.setUserEmail(userEmail);
        }
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(entity);
        writeSessionLog(entity.getId(), "SESSION_CREATED", null);
        return entity.getId();
    }

    /** List recent sessions for a given user (newest first, up to 50). */
    public List<Map<String, Object>> listSessions(String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return List.of();
        }
        return sessionRepo.findByUserEmailOrderByCreatedAtDesc(userEmail).stream()
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

    /** Mark a session as COMPLETED (called when user ends session from proposal summary). */
    @Transactional
    public Map<String, Object> completeSession(String sessionId) {
        CustomerSessionEntity session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
        session.setStatus("COMPLETED");
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(session);
        writeSessionLog(sessionId, "SESSION_COMPLETED", null);
        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", session.getId());
        result.put("status", session.getStatus());
        result.put("updatedAt", session.getUpdatedAt().toString());
        return result;
    }

    /** Retrieve all stored answers for a session. */
    public List<CustomerAnswerEntity> getAnswers(String sessionId) {
        return answerRepo.findBySessionId(sessionId);
    }

    /** Retrieve answers as a flat map (key → value) for frontend consumption. */
    public Map<String, Object> getAnswersAsMap(String sessionId) {
        List<CustomerAnswerEntity> answers = answerRepo.findBySessionId(sessionId);
        Map<String, Object> answerMap = new HashMap<>();
        for (CustomerAnswerEntity ans : answers) {
            try {
                Object value = objectMapper.readValue(ans.getValueJson(), Object.class);
                answerMap.put(ans.getKey(), value);
            } catch (JsonProcessingException e) {
                answerMap.put(ans.getKey(), ans.getValueJson());
            }
        }
        return answerMap;
    }

    /** Retrieve the latest recommendation run for a session (if exists). */
    public Map<String, Object> getLatestRecommendationRun(String sessionId) {
        List<RecommendationRunEntity> runs = runRepo.findBySessionIdOrderByCreatedAtDesc(sessionId);
        if (runs.isEmpty()) {
            return null;
        }
        RecommendationRunEntity latestRun = runs.get(0);
        try {
            Map<String, Object> recommendationData = objectMapper.readValue(latestRun.getResponseJson(), Map.class);
            Map<String, Object> response = new HashMap<>();
            response.put("runId", latestRun.getId());
            response.put("createdAt", latestRun.getCreatedAt().toString());
            response.put("data", recommendationData);
            return response;
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse recommendation response JSON: {}", e.getMessage());
            return null;
        }
    }

    /** Upload a customer document and keep full history while moving latest pointers. */
    @Transactional
    public Map<String, Object> uploadDocument(
            String sessionId,
            String docType,
            String docSide,
            MultipartFile file,
            String requesterEmail) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file is required");
        }

        String normalizedType = normalizeDocType(docType);
        String normalizedSide = normalizeDocSide(normalizedType, docSide);

        CustomerSessionEntity session = getSession(sessionId);
        assertSessionAccess(session, requesterEmail);

        Path storedPath = storeCustomerDocumentFile(sessionId, normalizedType, normalizedSide, file);

        int nextVersion = documentRepo.findBySessionIdAndDocTypeAndDocSideOrderByVersionNoDesc(
                sessionId,
                normalizedType,
                normalizedSide
        ).stream().map(CustomerDocumentEntity::getVersionNo)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(0) + 1;

        documentRepo.findFirstBySessionIdAndDocTypeAndDocSideAndLatestForSessionTrueOrderByUploadedAtDesc(
                sessionId,
                normalizedType,
                normalizedSide
        ).ifPresent(existing -> {
            existing.setLatestForSession(false);
            documentRepo.save(existing);
        });

        String userEmail = session.getUserEmail();
        if (userEmail != null && !userEmail.isBlank()) {
            documentRepo.findFirstByUserEmailAndDocTypeAndDocSideAndLatestForUserTrueOrderByUploadedAtDesc(
                    userEmail,
                    normalizedType,
                    normalizedSide
            ).ifPresent(existing -> {
                existing.setLatestForUser(false);
                documentRepo.save(existing);
            });
        }

        CustomerDocumentEntity doc = new CustomerDocumentEntity();
        doc.setSessionId(sessionId);
        doc.setUserEmail((userEmail == null || userEmail.isBlank()) ? null : userEmail);
        doc.setDocType(normalizedType);
        doc.setDocSide(normalizedSide);
        doc.setOriginalFilename(file.getOriginalFilename() == null ? "document" : file.getOriginalFilename());
        doc.setStoredFilename(storedPath.getFileName().toString());
        doc.setStoredPath(storedPath.toAbsolutePath().toString());
        doc.setContentType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setVersionNo(nextVersion);
        doc.setLatestForSession(true);
        doc.setLatestForUser(userEmail != null && !userEmail.isBlank());
        doc.setUploadedAt(LocalDateTime.now());

        CustomerDocumentEntity saved = documentRepo.save(doc);
        session.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(session);
        writeSessionLog(sessionId, "DOCUMENT_UPLOADED", normalizedType + (normalizedSide == null ? "" : (":" + normalizedSide)));

        Map<String, Object> response = new HashMap<>();
        response.put("document", toDocumentMap(saved, sessionId));
        return response;
    }

    /** Return latest documents linked to a specific session. */
    public Map<String, Object> getSessionDocuments(String sessionId, String requesterEmail) {
        CustomerSessionEntity session = getSession(sessionId);
        assertSessionAccess(session, requesterEmail);

        List<Map<String, Object>> documents = documentRepo
                .findBySessionIdAndLatestForSessionTrueOrderByUploadedAtDesc(sessionId)
                .stream()
                .map(doc -> toDocumentMap(doc, sessionId))
                .collect(Collectors.toCollection(ArrayList::new));

        Map<String, Object> response = new HashMap<>();
        response.put("sessionId", sessionId);
        response.put("documents", documents);
        return response;
    }

    /** Return latest user-level reusable documents for the authenticated customer. */
    public Map<String, Object> getLatestUserDocuments(String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new IllegalArgumentException("Authentication is required");
        }

        List<Map<String, Object>> documents = documentRepo
                .findByUserEmailAndLatestForUserTrueOrderByUploadedAtDesc(requesterEmail)
                .stream()
                .map(doc -> toDocumentMap(doc, doc.getSessionId()))
                .collect(Collectors.toCollection(ArrayList::new));

        Map<String, Object> response = new HashMap<>();
        response.put("documents", documents);
        return response;
    }

    /** Load a document file from storage after ownership verification. */
    public Map<String, Object> getDocumentDownload(String sessionId, Long documentId, String requesterEmail) {
        CustomerSessionEntity session = getSession(sessionId);
        assertSessionAccess(session, requesterEmail);

        CustomerDocumentEntity doc = documentRepo.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));
        if (!sessionId.equals(doc.getSessionId())) {
            throw new IllegalArgumentException("Document not found for session");
        }

        try {
            Path filePath = Paths.get(doc.getStoredPath()).toAbsolutePath().normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new IllegalArgumentException("Document file missing");
            }

            Map<String, Object> payload = new HashMap<>();
            payload.put("resource", resource);
            payload.put("filename", doc.getOriginalFilename());
            payload.put("contentType", doc.getContentType());
            return payload;
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Invalid document path", e);
        }
    }

    /** Upsert a batch of answers (key→value pairs) for a session. */
    @Transactional
    public void saveAnswers(String sessionId, Map<String, Object> answers) {
        // Ensure session exists
        CustomerSessionEntity session = getSession(sessionId);

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

        session.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(session);

        writeSessionLog(sessionId, "ANSWERS_SUBMITTED", answers.keySet().toString());
    }

    /** Build features from stored answers, call AI engine, persist run, return response. */
    @Transactional
    public Map<String, Object> getRecommendations(String sessionId) {
        CustomerSessionEntity session = getSession(sessionId);

        // Build feature map from stored answers
        Map<String, Object> features = buildFeatures(sessionId);
        features.putIfAbsent("taxRate", premiumTaxRate);

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
            log.info("Request for on AI-Engine - {}",reqData);
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

        session.setUpdatedAt(LocalDateTime.now());
        sessionRepo.save(session);

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
        BigDecimal basePremium = p.getBasePremium();
        if (basePremium == null || basePremium.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Invalid basePremium for product code={} value={}. Sending fallback marker value 0.0", p.getCode(), basePremium);
            m.put("basePremium", 0.0);
        } else {
            m.put("basePremium", basePremium);
        }
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

        if (p.getCategory() != null) {
            m.put("category", p.getCategory().getName());
            m.put("categoryCode", p.getCategory().getCode());
        }
        if (p.getSubcategory() != null) {
            m.put("subCategory", p.getSubcategory().getName());
            m.put("subCategoryCode", p.getSubcategory().getCode());
        }

        putParsedJson(m, "benefits", p.getBenefitsJson());
        putParsedJson(m, "riders", p.getRidersJson());
        putParsedJson(m, "eligibility", p.getEligibilityJson());
        putParsedJson(m, "sampleCalculations", p.getSampleCalculationsJson());
        putParsedJson(m, "paymentModes", p.getPaymentModesJson());

        putIfPresent(m, "howItWorks", p.getHowItWorksText());
        putIfPresent(m, "additionalBenefits", p.getAdditionalBenefitsText());

        if (p.getMinEligibleAge() != null) {
            m.put("minEligibleAge", p.getMinEligibleAge());
        }
        if (p.getMaxEligibleAge() != null) {
            m.put("maxEligibleAge", p.getMaxEligibleAge());
        }
        if (p.getMinPolicyTermYears() != null) {
            m.put("minPolicyTermYears", p.getMinPolicyTermYears());
        }
        if (p.getMaxPolicyTermYears() != null) {
            m.put("maxPolicyTermYears", p.getMaxPolicyTermYears());
        }
        return m;
    }

    private void putIfPresent(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value);
        }
    }

    private void putParsedJson(Map<String, Object> target, String key, String json) {
        if (json == null || json.isBlank()) {
            return;
        }
        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            target.put(key, parsed);
        } catch (JsonProcessingException e) {
            log.warn("Invalid JSON in product metadata field {}: {}", key, e.getMessage());
        }
    }

    private String normalizeDocType(String docType) {
        if (docType == null) {
            throw new IllegalArgumentException("docType is required");
        }
        String normalized = docType.trim().toLowerCase();
        if (!List.of("nic", "medical", "income").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported docType: " + docType);
        }
        return normalized;
    }

    private String normalizeDocSide(String docType, String docSide) {
        if (!"nic".equals(docType)) {
            return null;
        }
        if (docSide == null || docSide.isBlank()) {
            throw new IllegalArgumentException("docSide is required for NIC");
        }
        String normalized = docSide.trim().toLowerCase();
        if (!List.of("front", "back").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported docSide: " + docSide);
        }
        return normalized;
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

    private Path storeCustomerDocumentFile(String sessionId, String docType, String docSide, MultipartFile file) {
        try {
            Path root = Paths.get(uploadsDir).toAbsolutePath().normalize();
            Path docRoot = root.resolve("customer-documents").resolve(sessionId).resolve(docType);
            if (docSide != null) {
                docRoot = docRoot.resolve(docSide);
            }
            Files.createDirectories(docRoot);

            String original = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
            String storedName = UUID.randomUUID() + "_" + original;
            Path destination = docRoot.resolve(storedName).normalize();
            file.transferTo(destination.toFile());
            return destination;
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to store document", e);
        }
    }

    private Map<String, Object> toDocumentMap(CustomerDocumentEntity doc, String sessionId) {
        Map<String, Object> map = new HashMap<>();
        map.put("documentId", doc.getId());
        map.put("sessionId", sessionId);
        map.put("docType", doc.getDocType());
        map.put("docSide", doc.getDocSide());
        map.put("uploaded", true);
        map.put("originalFilename", doc.getOriginalFilename());
        map.put("uploadedAt", doc.getUploadedAt() == null ? null : doc.getUploadedAt().toString());
        map.put("versionNo", doc.getVersionNo());
        map.put("downloadUrl", "/api/customer/sessions/" + sessionId + "/documents/" + doc.getId() + "/download");
        return map;
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
