package com.insuranceuniversity.backend.service;

import java.util.List;
import java.util.Map;

public interface ChatOrchestrator {

    ChatExtractionResult extractAnswers(String message, Map<String, Object> existingAnswers);

    List<Map<String, String>> missingCoreFields(Map<String, Object> answers);
}
