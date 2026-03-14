package com.insuranceuniversity.backend.controller;

import com.insuranceuniversity.backend.entity.*;
import com.insuranceuniversity.backend.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/dev")
public class DevSeedController {

    private final EligibilityRuleRepository ruleRepo;
    private final PricingTableRepository pricingRepo;
    private final ModelVersionRepository modelRepo;
    private final SessionLogRepository logRepo;
    private final UnmatchedNeedRepository needRepo;

    public DevSeedController(EligibilityRuleRepository ruleRepo,
                             PricingTableRepository pricingRepo,
                             ModelVersionRepository modelRepo,
                             SessionLogRepository logRepo,
                             UnmatchedNeedRepository needRepo) {
        this.ruleRepo = ruleRepo;
        this.pricingRepo = pricingRepo;
        this.modelRepo = modelRepo;
        this.logRepo = logRepo;
        this.needRepo = needRepo;
    }

    @PostMapping("/seed")
    public ResponseEntity<Map<String, String>> seed() {
        // Seed a rule
        EligibilityRuleEntity rule = new EligibilityRuleEntity();
        rule.setName("Sample Eligibility Rule");
        rule.setRuleJson("{\"minAge\":18,\"maxAge\":65,\"minIncome\":50000}");
        rule.setVersion(1);
        rule.setEffectiveFrom(LocalDate.now());
        ruleRepo.save(rule);

        // Seed a pricing table
        PricingTableEntity pricing = new PricingTableEntity();
        pricing.setName("Standard Pricing Table");
        pricing.setPricingJson("{\"baseRate\":0.05,\"ageMultiplier\":1.2}");
        pricing.setVersion(1);
        pricing.setEffectiveFrom(LocalDate.now());
        pricingRepo.save(pricing);

        // Seed a model version
        List<ModelVersionEntity> existingModels = modelRepo.findAll();
        existingModels.forEach(m -> m.setActive(false));
        modelRepo.saveAll(existingModels);
        ModelVersionEntity model = new ModelVersionEntity();
        model.setName("Model v1.0");
        model.setDescription("Initial trained model");
        model.setActive(true);
        modelRepo.save(model);

        // Seed 10 session logs
        String[] events = {"page_view", "form_submit", "recommendation_view", "survey_start", "survey_complete"};
        String[] segments = {"youth", "family", "senior", "professional"};
        for (int i = 0; i < 10; i++) {
            SessionLogEntity log = new SessionLogEntity();
            log.setSessionHash("seed_hash_" + i);
            log.setTimestamp(LocalDateTime.now().minusHours(i * 2L));
            log.setEventType(events[i % events.length]);
            log.setUserSegment(segments[i % segments.length]);
            log.setPayloadJson("{\"step\":" + (i + 1) + "}");
            logRepo.save(log);
        }

        // Seed an unmatched need
        UnmatchedNeedEntity need = new UnmatchedNeedEntity();
        need.setTheme("Flood insurance coverage");
        need.setOccurrences(42);
        need.setSampleAnonymisedText("User asked about flood coverage multiple times but no matching plan found.");
        needRepo.save(need);

        return ResponseEntity.ok(Map.of("status", "seeded"));
    }
}
