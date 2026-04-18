package com.insuranceuniversity.backend.service;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public record ChatExtractionResult(
        Map<String, Object> extractedAnswers,
        String extractionMode,
        String fallbackReason
) {
    public ChatExtractionResult {
        extractedAnswers = extractedAnswers == null
                ? Collections.emptyMap()
                : Collections.unmodifiableMap(new HashMap<>(extractedAnswers));
        extractionMode = (extractionMode == null || extractionMode.isBlank())
                ? "deterministic"
                : extractionMode;
    }
}
