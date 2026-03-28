package com.insuranceuniversity.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AiEngineClient {

    private static final Logger log = LoggerFactory.getLogger(AiEngineClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String aiEngineBaseUrl;

    public AiEngineClient(
            @Value("${app.aiEngineUrl:http://localhost:8000}") String aiEngineUrl,
            ObjectMapper objectMapper) {
        this.aiEngineBaseUrl = (aiEngineUrl == null || aiEngineUrl.isBlank())
            ? "http://localhost:8000"
            : aiEngineUrl.replaceAll("/+$", "");
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
            String requestJson = objectMapper.writeValueAsString(requestBody);
            log.info("Calling AI engine /score for session={}", sessionId);
            String responseBody = restClient.post()
                    .uri("/score")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestJson)
                    .retrieve()
                    .body(String.class);

            return objectMapper.readValue(responseBody, Map.class);
        } catch (HttpClientErrorException.UnprocessableEntity e) {
            log.warn("AI engine /score returned 422 for session={}, retrying with raw JSON request. body={} ",
                    sessionId, e.getResponseBodyAsString());
            try {
                String responseBody = scoreRawJson(requestBody);
                return objectMapper.readValue(responseBody, Map.class);
            } catch (JsonProcessingException ex) {
                log.error("Failed to parse AI engine /score fallback response", ex);
                throw new RuntimeException("AI engine score response parsing failed", ex);
            } catch (IOException ex) {
                log.error("AI engine /score fallback call failed for session={}", sessionId, ex);
                throw new RuntimeException("AI engine score fallback unavailable: " + ex.getMessage(), ex);
            }
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
        return trainBytes(bytes, filename);
    }

    /**
     * Calls the AI engine POST /train endpoint using a file already on disk.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> trainFromPath(String storedPath, String originalFilename) throws IOException {
        byte[] bytes = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(storedPath));
        String filename = originalFilename != null ? originalFilename : "dataset.csv";
        return trainBytes(bytes, filename);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> activateModel(String artifactId) {
        try {
            log.info("Calling AI engine /models/{}/activate", artifactId);
            String responseBody = restClient.post()
                    .uri("/models/{artifactId}/activate", artifactId)
                    .retrieve()
                    .body(String.class);

            return objectMapper.readValue(responseBody, Map.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI engine activate response", e);
            throw new RuntimeException("AI engine activate response parsing failed", e);
        } catch (Exception e) {
            log.error("AI engine model activation failed for artifactId={}", artifactId, e);
            throw new RuntimeException("AI engine model activation unavailable: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> trainBytes(byte[] bytes, String filename) throws IOException {
        try {
            log.info("Calling AI engine /train with file={}", filename);
            String responseBody = trainBytesRawMultipart(bytes, filename);
            return objectMapper.readValue(responseBody, Map.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse AI engine train response", e);
            throw new RuntimeException("AI engine train response parsing failed", e);
        } catch (Exception e) {
            log.error("AI engine /train call failed", e);
            throw new RuntimeException("AI engine train unavailable: " + e.getMessage(), e);
        }
    }

    private String trainBytesRawMultipart(byte[] bytes, String filename) throws IOException {
        String boundary = "----InsuranceBoundary" + UUID.randomUUID();
        URL url = new URL(aiEngineBaseUrl + "/train");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

        String safeFilename = (filename == null || filename.isBlank())
                ? "dataset.csv"
                : filename.replace("\"", "");

        try (OutputStream out = connection.getOutputStream()) {
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + safeFilename + "\"\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            out.write("Content-Type: text/csv\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            out.write(bytes);
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }

        int status = connection.getResponseCode();
        try (InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream()) {
            String responseBody = stream != null
                    ? new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                    : "";

            if (status < 200 || status >= 300) {
                throw new RuntimeException("AI engine /train failed with HTTP " + status + ": " + responseBody);
            }
            return responseBody;
        } finally {
            connection.disconnect();
        }
    }

    private String scoreRawJson(Map<String, Object> requestBody) throws IOException {
        URL url = new URL(aiEngineBaseUrl + "/score");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");

        byte[] payload = objectMapper.writeValueAsBytes(requestBody);
        try (OutputStream out = connection.getOutputStream()) {
            out.write(payload);
        }

        int status = connection.getResponseCode();
        try (InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream()) {
            String responseBody = stream != null
                    ? new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                    : "";

            if (status < 200 || status >= 300) {
                throw new RuntimeException("AI engine /score failed with HTTP " + status + ": " + responseBody);
            }
            return responseBody;
        } finally {
            connection.disconnect();
        }
    }
}
