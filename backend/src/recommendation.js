const { db } = require('./db');

/**
 * Generate insurance recommendations for a session.
 * @param {string} sessionId
 * @param {Object} disclosureMap  key/value map of all disclosures for the session
 * @returns {Array} sorted recommendation objects
 */
function generateRecommendations(sessionId, disclosureMap) {
  const age = parseInt(disclosureMap.age, 10) || 0;
  const income = parseFloat(disclosureMap.income) || 0;
  const dependents = parseInt(disclosureMap.dependents, 10) || 0;
  const bmi = parseFloat(disclosureMap.bmi) || 0;
  const smoker = String(disclosureMap.smoker || '').toLowerCase();
  const healthConditions = disclosureMap.health_conditions || '';
  const coverageNeed = disclosureMap.coverage_need || '';

  // ------------------------------------------------------------------
  // 1. Determine risk score from risk_rules
  // ------------------------------------------------------------------
  const rules = db.prepare('SELECT * FROM risk_rules').all();

  let riskScore = 0.3;   // default Low
  let riskLevel = 'Low';
  let recommendedPolicyType = 'life';

  for (const rule of rules) {
    const ageMatch =
      (rule.age_min === null || age >= rule.age_min) &&
      (rule.age_max === null || age <= rule.age_max);

    const incomeMatch =
      (rule.income_min === null || income >= rule.income_min) &&
      (rule.income_max === null || income <= rule.income_max);

    const bmiMatch =
      (rule.bmi_min === null || bmi >= rule.bmi_min) &&
      (rule.bmi_max === null || bmi <= rule.bmi_max);

    const smokerMatch =
      rule.smoker === 'any' ||
      (rule.smoker === 'yes' && (smoker === 'yes' || smoker === 'true' || smoker === '1')) ||
      (rule.smoker === 'no' && (smoker === 'no' || smoker === 'false' || smoker === '0'));

    const dependentsMatch =
      (rule.dependents_min === null || dependents >= rule.dependents_min) &&
      (rule.dependents_max === null || dependents <= rule.dependents_max);

    if (ageMatch && incomeMatch && bmiMatch && smokerMatch && dependentsMatch) {
      // Take highest risk score among matching rules
      if (rule.risk_score > riskScore) {
        riskScore = rule.risk_score;
        riskLevel = rule.risk_level;
        recommendedPolicyType = rule.recommended_policy_type;
      }
    }
  }

  // Override recommended type if user explicitly stated coverage need
  if (coverageNeed) {
    const needLower = coverageNeed.toLowerCase();
    if (['life', 'health', 'retirement', 'investment'].some(t => needLower.includes(t))) {
      for (const t of ['life', 'health', 'retirement', 'investment']) {
        if (needLower.includes(t)) {
          recommendedPolicyType = t;
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Fetch and filter eligible policies
  // ------------------------------------------------------------------
  const policies = db.prepare('SELECT * FROM policies WHERE active = 1').all();

  const eligible = policies.filter(p => {
    const ageOk = (!p.min_age || age >= p.min_age) && (!p.max_age || age <= p.max_age);
    const incomeOk = !p.min_income || income >= p.min_income;
    return ageOk && incomeOk;
  });

  if (eligible.length === 0) {
    return [];
  }

  // ------------------------------------------------------------------
  // 3. Score each eligible policy
  // ------------------------------------------------------------------
  const ANNUAL_INCOME_THRESHOLD = 0.15; // premium should be ≤15% of income for full score

  const scored = eligible.map(policy => {
    // Suitability: type match gives high base, risk alignment adds more
    let suitabilityScore = 0.5;

    if (policy.type === recommendedPolicyType) {
      suitabilityScore += 0.3;
    }

    // Health conditions hint toward health/critical cover
    if (healthConditions && healthConditions.toLowerCase() !== 'none' && healthConditions.trim() !== '') {
      if (policy.type === 'health') suitabilityScore += 0.1;
    }

    // Dependents hint toward family/life coverage
    if (dependents > 0 && (policy.type === 'life' || policy.coverage_type === 'family')) {
      suitabilityScore += 0.1;
    }

    // Risk alignment
    if (riskLevel === 'High' && ['health', 'retirement'].includes(policy.type)) {
      suitabilityScore += 0.05;
    }

    suitabilityScore = Math.min(suitabilityScore, 1.0);

    // Affordability: annual premium vs income ratio
    let affordabilityScore = 1.0;
    if (income > 0 && policy.premium_base > 0) {
      const ratio = policy.premium_base / income;
      if (ratio <= ANNUAL_INCOME_THRESHOLD) {
        affordabilityScore = 1.0;
      } else if (ratio <= 0.3) {
        affordabilityScore = 0.7;
      } else if (ratio <= 0.5) {
        affordabilityScore = 0.4;
      } else {
        affordabilityScore = 0.2;
      }
    }

    const explanation = buildExplanation(policy, age, income, riskLevel, riskScore, dependents, smoker, healthConditions);

    return {
      session_id: sessionId,
      policy_id: policy.id,
      suitability_score: Math.round(suitabilityScore * 100) / 100,
      affordability_score: Math.round(affordabilityScore * 100) / 100,
      explanation,
      policy
    };
  });

  scored.sort((a, b) =>
    (b.suitability_score + b.affordability_score) - (a.suitability_score + a.affordability_score)
  );

  // Assign ranks
  scored.forEach((r, i) => { r.rank = i + 1; });

  return scored;
}

function buildExplanation(policy, age, income, riskLevel, riskScore, dependents, smoker, healthConditions) {
  const parts = [`Based on your age (${age}) and income (${formatCurrency(income)}), this policy is well-suited because:`];

  parts.push(`• ${policy.name} is a ${policy.type} plan with a base premium of ${formatCurrency(policy.premium_base)} per year.`);

  if (riskLevel === 'Low') {
    parts.push(`• Your risk profile is LOW (score: ${riskScore}), making affordable coverage options ideal for building long-term security.`);
  } else if (riskLevel === 'Medium') {
    parts.push(`• Your risk profile is MEDIUM (score: ${riskScore}), suggesting balanced protection with both life and health elements.`);
  } else {
    parts.push(`• Your risk profile is HIGH (score: ${riskScore}), prioritising comprehensive coverage to mitigate elevated risk factors.`);
  }

  if (dependents > 0) {
    parts.push(`• With ${dependents} dependent(s), this plan helps ensure financial security for your family.`);
  }

  if (smoker === 'yes' || smoker === 'true' || smoker === '1') {
    parts.push(`• As a smoker, this plan accounts for heightened health risks in its coverage terms.`);
  }

  if (healthConditions && healthConditions.toLowerCase() !== 'none' && healthConditions.trim() !== '') {
    parts.push(`• Your reported health condition(s) (${healthConditions}) make health-related coverage a priority.`);
  }

  return parts.join('\n');
}

function formatCurrency(amount) {
  if (!amount) return '$0';
  return '$' + Number(amount).toLocaleString('en-US');
}

module.exports = { generateRecommendations };
