package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class AiEngineClient {

    private static final Logger log = LoggerFactory.getLogger(AiEngineClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public AiEngineClient(
            @Value("${app.aiEngineUrl:http://localhost:8000}") String aiEngineUrl,
            ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(aiEngineUrl).build();
        this.objectMapper = objectMapper;
    }

    /**
     * Calls the AI engine POST /score endpoint.
     *
     * @param sessionId  customer session id
     * @param features   map of feature key→value (age, income, smoker, …)
     * @param products   list of product maps with code, name, basePremium, tags
     * @return raw response map parsed from JSON
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> score(String sessionId, Map<String, Object> features, List<Map<String, Object>> products) {
        Map<String, Object> requestBody = Map.of(
                "sessionId", sessionId,
                "features", features,
                "products", products
        );

        try {
            log.info("Calling AI engine /score for session={}", sessionId);
            String responseBody = restClient.post()
                    .uri("/score")
                    .header("Content-Type", "application/json")
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            return objectMapper.readValue(responseBody, Map.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI engine response", e);
            throw new RuntimeException("AI engine response parsing failed", e);
        } catch (Exception e) {
            log.error("AI engine call failed for session={}", sessionId, e);
            throw new RuntimeException("AI engine unavailable: " + e.getMessage(), e);
        }
    }
}
