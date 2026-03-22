from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
import logging
import csv
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Insurance AI Engine", version="2.0.0")

# ---------------------------------------------------------------------------
# In-memory feature weights — updated via /train
# ---------------------------------------------------------------------------
_weights: dict[str, float] = {
    "age_young_boost":          0.10,
    "age_old_penalty":          0.15,
    "smoker_penalty":           0.20,
    "nonsmoker_boost":          0.05,
    "dependent_boost":          0.10,
    "ratio_high_penalty":       0.10,
    "ratio_low_boost":          0.05,
    "senior_cap_penalty":       0.30,
    "condition_penalty":        0.05,
    "smoker_risk_pct":          0.25,
    "age_old_risk_pct":         0.15,
    "condition_risk_pct":       0.05,
    # Collaborative filtering weights
    "postgrad_invest_boost":    0.12,
    "undergrad_invest_boost":   0.06,
    "low_hazard_invest_boost":  0.08,
    "high_expense_protection":  0.10,
    "low_networth_protection":  0.08,
    "afford_penalty":           0.15,
    "safety_priority_boost":    0.04,
    "equity_priority_invest":   0.05,
    "family_history_penalty":   0.05,
}

# ---------------------------------------------------------------------------
# Maximum cap on life coverage (system-defined scheme limit)
# ---------------------------------------------------------------------------
MAX_COVERAGE_LKR = 50_000_000  # Rs. 50 million

# Affordability threshold: premium must not exceed this fraction of disposable income
AFFORDABILITY_THRESHOLD = 0.20


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class Product(BaseModel):
    code: str
    name: str
    basePremium: float
    tags: Optional[list[str]] = []


class ScoreRequest(BaseModel):
    sessionId: str
    features: dict[str, Any]
    products: list[Product]


class RankedProduct(BaseModel):
    code: str
    name: str
    policyType: str
    score: float
    monthlyPremiumEstimate: float
    affordabilityScore: float
    lapseProbability: float
    reasons: list[str]
    eligibilityDecision: str
    predictedCoverage: float
    suitabilityRank: int
    riderExclusions: list[str]


class ScoreResponse(BaseModel):
    sessionId: str
    rankedProducts: list[RankedProduct]


class TrainResponse(BaseModel):
    message: str
    rowsProcessed: int
    updatedWeights: dict[str, float]


# ---------------------------------------------------------------------------
# CART Underwriting Engine (Task 1)
# ---------------------------------------------------------------------------

def _run_cart_underwriting(features: dict[str, Any]) -> tuple[str, list[str]]:
    """
    Execute Classification and Regression Tree (CART) underwriting rules.
    Returns (eligibility_decision, exclusion_reasons).
    eligibility_decision: 'Eligible' | 'No Offer' | 'Referral Required'
    """
    age = int(features.get("age", 30))
    heart_disease = bool(features.get("heartDisease", False))
    cancer = bool(features.get("cancer", False))
    stroke = bool(features.get("stroke", False))
    kidney_disorder = bool(features.get("kidneyDisorder", False))
    hospitalization = bool(features.get("hospitalization5Yrs", False))
    is_pep = bool(features.get("isPep", False))
    has_criminal = bool(features.get("hasCriminalHistory", False))

    exclusions: list[str] = []

    # Rule A: Age Gate
    if age < 18 or age >= 65.5:
        return "No Offer", ["Age outside eligible range (18–65)"]

    # Rule B: Traditional Disease Factor — any positive → No Offer
    disease_flags = {
        "Heart disease / high blood pressure / high cholesterol": heart_disease,
        "Cancer / tumor / growth": cancer,
        "Stroke / kidney disorder / nervous disorder": stroke,
        "Other organ health issues": kidney_disorder,
    }
    triggered = [name for name, flag in disease_flags.items() if flag]
    if triggered:
        return "No Offer", [f"Traditional disease disclosure: {', '.join(triggered)}"]

    # Rule C: Clinical History — triggers referral / No Offer for Critical Illness rider
    if hospitalization:
        exclusions.append("Critical Illness rider excluded due to recent hospitalisation or surgery")

    # Rule D (Legal): PEP or criminal history → Referral Required
    if is_pep or has_criminal:
        return "Referral Required", exclusions + ["PEP status or criminal history requires enhanced underwriting"]

    return "Eligible", exclusions


# ---------------------------------------------------------------------------
# Rider exclusion logic (Rule D)
# ---------------------------------------------------------------------------

def _get_rider_exclusions(features: dict[str, Any], base_exclusions: list[str]) -> list[str]:
    """Determine which riders must be excluded."""
    exclusions = list(base_exclusions)
    hazardous = bool(features.get("hazardousPursuits", False))
    flying = bool(features.get("flyingActivity", False))

    if hazardous or flying:
        exclusions.append("Accidental Death Benefit rider excluded (hazardous pursuits / non-scheduled flying)")

    return exclusions


# ---------------------------------------------------------------------------
# Policy-type classification (enhanced)
# ---------------------------------------------------------------------------

def _classify_policy_type(tags: list[str], features: dict[str, Any]) -> str:
    """Classify the product into Life, Retirement, Investment, or Critical Illness."""
    tag_set = set(t.lower() for t in tags)
    age = int(features.get("age", 30))
    protection_purpose = features.get("protectionPurpose", "")
    priority_equity = int(features.get("priorityEquity", 3))
    priority_safety = int(features.get("prioritySafety", 3))

    if "critical" in tag_set or "ci" in tag_set or "illness" in tag_set:
        return "Critical Illness"
    if "retirement" in tag_set or protection_purpose == "RetirementSupplement" or (age >= 45 and "invest" not in tag_set):
        return "Retirement"
    if "investment" in tag_set or "invest" in tag_set or "ulip" in tag_set or priority_equity >= 4:
        return "Investment"
    if "health" in tag_set or "medical" in tag_set:
        return "Critical Illness"
    # Default to Life for term/whole/family products
    return "Life"


# ---------------------------------------------------------------------------
# Collaborative Filtering Suitability Scoring (Task 2)
# ---------------------------------------------------------------------------

def _collaborative_filter_boost(features: dict[str, Any], product: "Product", w: dict[str, float]) -> tuple[float, list[str]]:
    """
    Apply collaborative filtering boosts based on education level, occupation,
    income/expense ratio, net worth, and design priorities.
    Returns (score_delta, reasons).
    """
    delta = 0.0
    reasons: list[str] = []
    tags = [t.lower() for t in (product.tags or [])]

    education = features.get("educationLevel", "Undergrad")
    hazard_level = int(features.get("occupationHazardLevel", 3))
    monthly_income = float(features.get("income", features.get("monthlyIncomeLkr", 50000)))
    monthly_expenses = float(features.get("monthlyExpensesLkr", 30000))
    net_worth = float(features.get("netWorthLkr", 0))
    priority_safety = int(features.get("prioritySafety", 3))
    priority_equity = int(features.get("priorityEquity", 3))
    family_history = bool(features.get("familyHistory", False))

    is_invest = any(t in tags for t in ["investment", "invest", "ulip"])
    is_protection = any(t in tags for t in ["term", "life", "family", "critical", "ci"])

    # Cluster: high education + low hazard → boost investment products
    if education == "Postgrad" and is_invest:
        delta += w["postgrad_invest_boost"]
        reasons.append("Postgraduate profile — higher affinity for investment products")
    elif education == "Undergrad" and is_invest:
        delta += w["undergrad_invest_boost"]

    if hazard_level <= 2 and is_invest:
        delta += w["low_hazard_invest_boost"]
        reasons.append("Low occupation hazard — investment products well-suited")

    # Cluster: high expenses + low net worth → boost pure protection
    disposable = monthly_income - monthly_expenses
    if monthly_expenses > monthly_income * 0.6 and is_protection:
        delta += w["high_expense_protection"]
        reasons.append("High expense ratio — protection plan recommended for financial security")

    if net_worth < monthly_income * 6 and is_protection:
        delta += w["low_networth_protection"]
        reasons.append("Lower net worth — pure protection cover prioritised")

    # Design priority alignment
    if priority_safety >= 4 and is_protection:
        delta += w["safety_priority_boost"]
        reasons.append("Safety-first priority aligns with protection product")
    if priority_equity >= 4 and is_invest:
        delta += w["equity_priority_invest"]
        reasons.append("Equity priority aligns with investment product")

    # Family history risk penalises all products
    if family_history:
        delta -= w["family_history_penalty"]
        reasons.append("Family medical history noted — slight risk adjustment")

    return delta, reasons


# ---------------------------------------------------------------------------
# Coverage Prediction (Task 3)
# ---------------------------------------------------------------------------

def _predict_coverage(features: dict[str, Any]) -> float:
    """
    Predict the Suitable Live Coverage amount.
    Uses protection purpose to determine calculation method.
    Cap at MAX_COVERAGE_LKR.
    """
    monthly_expenses = float(features.get("monthlyExpensesLkr", features.get("monthlyIncomeLkr", 50000) * 0.5))
    protection_purpose = features.get("protectionPurpose", "SurvivorIncome")
    children_ages_raw = features.get("childrenAges", "")

    if protection_purpose == "EducationFunding":
        # Calculate years until youngest child reaches 21
        if children_ages_raw:
            try:
                ages = [int(a.strip()) for a in str(children_ages_raw).split(",")
                        if a.strip().lstrip('-').isdigit()]
                if ages:
                    youngest = min(ages)
                    years_remaining = max(0, 21 - youngest)
                    if years_remaining > 0:
                        coverage = monthly_expenses * 12 * years_remaining
                        return round(min(coverage, MAX_COVERAGE_LKR), 0)
            except (ValueError, TypeError):
                pass
        # Fallback: 15-year education period (youngest child already 21+, or no children ages provided)
        coverage = monthly_expenses * 12 * 15
    elif protection_purpose == "RetirementSupplement":
        # 20-year retirement income replacement
        coverage = monthly_expenses * 12 * 20
    elif protection_purpose == "EstateLiquidity":
        net_worth = float(features.get("netWorthLkr", 0))
        coverage = max(monthly_expenses * 12 * 5, net_worth * 0.5)
    else:
        # Survivor Income: 10 years of expense replacement
        coverage = monthly_expenses * 12 * 10

    return round(min(max(coverage, 500_000), MAX_COVERAGE_LKR), 0)


# ---------------------------------------------------------------------------
# Affordability score
# ---------------------------------------------------------------------------

def _affordability_score(monthly_premium: float, income: float) -> float:
    """
    Returns a score in [0, 1] — higher means more affordable.
    Penalises if premium > 20% of disposable income (CART Rule).
    """
    if income <= 0:
        return 0.5
    ratio = monthly_premium / income
    if ratio <= 0.05:
        return 1.0
    if ratio <= 0.10:
        return 0.85
    if ratio <= 0.15:
        return 0.65
    if ratio <= AFFORDABILITY_THRESHOLD:
        return 0.45
    if ratio <= 0.30:
        return 0.25
    return 0.10


# ---------------------------------------------------------------------------
# Lapse probability prediction
# ---------------------------------------------------------------------------

def _lapse_probability(features: dict[str, Any], monthly_premium: float) -> float:
    """Heuristic estimate of lapse probability."""
    income = float(features.get("income", features.get("monthlyIncomeLkr", 50000)))
    age = int(features.get("age", 30))
    conditions = features.get("conditions", [])
    smoker = bool(features.get("smoker", False))

    prob = 0.10
    if income > 0:
        ratio = monthly_premium / income
        if ratio > AFFORDABILITY_THRESHOLD:
            prob += 0.25
        elif ratio > 0.15:
            prob += 0.15
        elif ratio > 0.10:
            prob += 0.05

    if age > 55:
        prob += 0.05
    if smoker:
        prob += 0.05
    if conditions:
        prob += 0.03 * min(len(conditions), 3)

    return round(min(prob, 0.95), 4)


# ---------------------------------------------------------------------------
# Core heuristic scoring (enhanced with collaborative filtering)
# ---------------------------------------------------------------------------

def _score_product(
    features: dict[str, Any], product: Product, w: dict[str, float]
) -> tuple[float, float, float, float, str, list[str]]:
    """Returns (score, premium_estimate, affordability, lapse_prob, policy_type, reasons)."""
    score = 0.5
    reasons: list[str] = []
    tags = [t.lower() for t in (product.tags or [])]

    age = int(features.get("age", 30))
    smoker = bool(features.get("smoker", False))
    dependents = int(features.get("dependents", features.get("memberCount", 0)))
    income = float(features.get("income", features.get("monthlyIncomeLkr", 50000)))
    monthly_expenses = float(features.get("monthlyExpensesLkr", income * 0.5))
    coverage = float(features.get("coverageAmount", product.basePremium * 100))

    # Age-based adjustments
    if age < 30:
        score += w["age_young_boost"]
        reasons.append("Young applicant — lower risk")
    elif age > 55:
        score -= w["age_old_penalty"]
        reasons.append("Age over 55 — higher risk premium")

    # Smoker penalty
    if smoker:
        score -= w["smoker_penalty"]
        reasons.append("Tobacco use increases premium")
    else:
        score += w["nonsmoker_boost"]
        reasons.append("Non-smoker discount applied")

    # Dependents boost for family/life products
    if dependents > 0 and any(t in tags for t in ["life", "family", "term"]):
        score += w["dependent_boost"] * min(dependents, 3)
        reasons.append(f"{dependents} dependent(s) — family coverage recommended")

    # Income-to-coverage ratio
    if income > 0:
        ratio = coverage / (income * 12)
        if ratio > 10:
            score -= w["ratio_high_penalty"]
            reasons.append("Coverage amount is very high relative to income")
        elif ratio <= 5:
            score += w["ratio_low_boost"]
            reasons.append("Affordable coverage-to-income ratio")

    # Penalise age cap
    if age > 65 and "senior" not in tags:
        score -= w["senior_cap_penalty"]
        reasons.append("Product not designed for applicants over 65")

    # Health conditions
    conditions = features.get("conditions", [])
    if conditions:
        score -= w["condition_penalty"] * len(conditions)
        reasons.append(f"{len(conditions)} pre-existing condition(s) noted")

    # Affordability check: penalise if target premium exceeds 20% of disposable income
    disposable = max(income - monthly_expenses, 0)
    if disposable > 0:
        premium_ratio = product.basePremium / disposable
        if premium_ratio > AFFORDABILITY_THRESHOLD:
            score -= w["afford_penalty"]
            reasons.append(f"Premium exceeds {int(AFFORDABILITY_THRESHOLD * 100)}% of disposable income — affordability penalty applied")

    # Apply collaborative filtering boosts
    cf_delta, cf_reasons = _collaborative_filter_boost(features, product, w)
    score += cf_delta
    reasons.extend(cf_reasons)

    score = round(max(0.0, min(1.0, score)), 4)

    # Premium estimate with risk multiplier
    risk_multiplier = 1.0
    if smoker:
        risk_multiplier += w["smoker_risk_pct"]
    if age > 55:
        risk_multiplier += w["age_old_risk_pct"]
    if conditions:
        risk_multiplier += w["condition_risk_pct"] * len(conditions)

    premium_estimate = round(product.basePremium * risk_multiplier, 2)

    affordability = _affordability_score(premium_estimate, income)
    lapse_prob = _lapse_probability(features, premium_estimate)
    policy_type = _classify_policy_type(tags, features)

    return score, premium_estimate, affordability, lapse_prob, policy_type, reasons


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-engine", "version": "2.0.0"}


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest):
    logger.info("Scoring session=%s products=%d", request.sessionId, len(request.products))

    # Step 1: CART underwriting
    eligibility_decision, base_exclusions = _run_cart_underwriting(request.features)
    rider_exclusions = _get_rider_exclusions(request.features, base_exclusions)

    # Step 3: Predict coverage
    predicted_coverage = _predict_coverage(request.features)

    ranked: list[RankedProduct] = []
    for product in request.products:
        s, premium, afford, lapse, pol_type, reasons = _score_product(
            request.features, product, _weights
        )

        # If no offer globally, score is 0 and reasons reflect that
        effective_decision = eligibility_decision
        effective_score = s
        effective_reasons = reasons
        if eligibility_decision == "No Offer":
            effective_score = 0.0
            effective_reasons = base_exclusions + reasons

        ranked.append(
            RankedProduct(
                code=product.code,
                name=product.name,
                policyType=pol_type,
                score=effective_score,
                monthlyPremiumEstimate=premium,
                affordabilityScore=round(afford, 4),
                lapseProbability=lapse,
                reasons=effective_reasons,
                eligibilityDecision=effective_decision,
                predictedCoverage=predicted_coverage,
                suitabilityRank=0,  # assigned below
                riderExclusions=rider_exclusions,
            )
        )

    ranked.sort(key=lambda p: p.score, reverse=True)
    # Assign suitability ranks
    for idx, p in enumerate(ranked):
        p.suitabilityRank = idx + 1

    return ScoreResponse(sessionId=request.sessionId, rankedProducts=ranked)


@app.post("/train", response_model=TrainResponse)
async def train(file: UploadFile = File(...)):
    """
    Accept a CSV training dataset to update feature weights.
    Expected CSV columns (all optional): age, smoker, dependents, income,
    coverageAmount, conditions_count, outcome_score (0-1 ground truth).
    Admin function: retrains RBM weights and logs model version.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    smoker_scores: list[float] = []
    nonsmoker_scores: list[float] = []
    young_scores: list[float] = []
    old_scores: list[float] = []
    no_offer_count = 0
    invest_scores: list[float] = []
    protect_scores: list[float] = []

    valid_rows = 0
    for row in rows:
        try:
            outcome = float(row.get("outcome_score", row.get("score", 0.5)))
            age = int(row.get("age", 30))
            smoker = str(row.get("smoker", "false")).lower() in ("true", "1", "yes")
            policy_type = str(row.get("policy_type", "")).lower()
            eligibility = str(row.get("eligibility", "eligible")).lower()

            if eligibility == "no offer":
                no_offer_count += 1

            if smoker:
                smoker_scores.append(outcome)
            else:
                nonsmoker_scores.append(outcome)

            if age < 30:
                young_scores.append(outcome)
            elif age > 55:
                old_scores.append(outcome)

            if "invest" in policy_type:
                invest_scores.append(outcome)
            elif "life" in policy_type or "term" in policy_type:
                protect_scores.append(outcome)

            valid_rows += 1
        except (ValueError, TypeError):
            continue

    # Update weights based on dataset averages
    if smoker_scores and nonsmoker_scores:
        non_avg = sum(nonsmoker_scores) / len(nonsmoker_scores)
        smo_avg = sum(smoker_scores) / len(smoker_scores)
        diff = non_avg - smo_avg
        if diff < 0:
            logger.warning(
                "Unexpected pattern: smokers scored higher (diff=%.4f). skipping smoker_penalty update.", diff
            )
        else:
            _weights["smoker_penalty"] = round(min(max(diff, 0.05), 0.40), 4)

    if young_scores and old_scores:
        young_avg = sum(young_scores) / len(young_scores)
        old_avg = sum(old_scores) / len(old_scores)
        _weights["age_young_boost"] = round(min(max(young_avg - 0.5, 0.02), 0.25), 4)
        _weights["age_old_penalty"] = round(min(max(0.5 - old_avg, 0.02), 0.30), 4)

    if invest_scores and protect_scores:
        invest_avg = sum(invest_scores) / len(invest_scores)
        protect_avg = sum(protect_scores) / len(protect_scores)
        if invest_avg > protect_avg:
            _weights["postgrad_invest_boost"] = round(min(_weights["postgrad_invest_boost"] + 0.01, 0.25), 4)
        else:
            _weights["high_expense_protection"] = round(min(_weights["high_expense_protection"] + 0.01, 0.25), 4)

    logger.info(
        "Training complete: %d valid rows, %d no-offer rows. Updated weights: %s",
        valid_rows, no_offer_count, _weights
    )

    return TrainResponse(
        message=f"Training complete. {valid_rows} rows processed. {no_offer_count} 'No Offer' cases analysed for market gap insights.",
        rowsProcessed=valid_rows,
        updatedWeights=dict(_weights),
    )

