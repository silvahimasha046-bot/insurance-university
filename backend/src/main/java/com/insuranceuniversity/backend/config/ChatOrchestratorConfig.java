package com.insuranceuniversity.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.insuranceuniversity.backend.service.ChatOrchestrator;
import com.insuranceuniversity.backend.service.DeterministicChatOrchestrator;
import com.insuranceuniversity.backend.service.LlmChatOrchestrator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatOrchestratorConfig {

    @Bean
    public DeterministicChatOrchestrator deterministicChatOrchestrator() {
        return new DeterministicChatOrchestrator();
    }

    @Bean
    public LlmChatOrchestrator llmChatOrchestrator(
            @Value("${app.llm.baseUrl:https://api.openai.com/v1}") String baseUrl,
            @Value("${app.llm.apiKey:}") String apiKey,
            @Value("${app.llm.model:gpt-4o-mini}") String model,
            @Value("${app.llm.timeoutMs:3500}") Integer timeoutMs,
            ObjectMapper objectMapper,
            DeterministicChatOrchestrator deterministic
    ) {
        return new LlmChatOrchestrator(baseUrl, apiKey, model, timeoutMs, objectMapper, deterministic);
    }

    @Bean
    public ChatOrchestrator chatOrchestrator(
            @Value("${app.chat.extractionMode:deterministic}") String extractionMode,
            DeterministicChatOrchestrator deterministic,
            LlmChatOrchestrator llm
    ) {
        if ("llm".equalsIgnoreCase(extractionMode)) {
            return llm;
        }
        return deterministic;
    }
}
