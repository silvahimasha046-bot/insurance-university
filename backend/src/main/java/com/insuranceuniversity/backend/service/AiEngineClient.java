package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
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

    /**
     * Calls the AI engine POST /train endpoint with a CSV file.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> train(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "dataset.csv";

        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() { return filename; }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", resource);

        try {
            log.info("Calling AI engine /train with file={}", filename);
            String responseBody = restClient.post()
                    .uri("/train")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            return objectMapper.readValue(responseBody, Map.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI engine train response", e);
            throw new RuntimeException("AI engine train response parsing failed", e);
        } catch (Exception e) {
            log.error("AI engine /train call failed", e);
            throw new RuntimeException("AI engine train unavailable: " + e.getMessage(), e);
        }
    }
}
