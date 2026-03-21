from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
import logging
import csv
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Insurance AI Engine", version="1.0.0")

# ---------------------------------------------------------------------------
# In-memory feature weights — updated via /train
# ---------------------------------------------------------------------------
_weights: dict[str, float] = {
    "age_young_boost":      0.10,
    "age_old_penalty":      0.15,
    "smoker_penalty":       0.20,
    "nonsmoker_boost":      0.05,
    "dependent_boost":      0.10,
    "ratio_high_penalty":   0.10,
    "ratio_low_boost":      0.05,
    "senior_cap_penalty":   0.30,
    "condition_penalty":    0.05,
    "smoker_risk_pct":      0.25,
    "age_old_risk_pct":     0.15,
    "condition_risk_pct":   0.05,
}


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


class ScoreResponse(BaseModel):
    sessionId: str
    rankedProducts: list[RankedProduct]


class TrainResponse(BaseModel):
    message: str
    rowsProcessed: int
    updatedWeights: dict[str, float]


# ---------------------------------------------------------------------------
# Policy-type classification helper
# ---------------------------------------------------------------------------

def _classify_policy_type(tags: list[str], features: dict[str, Any]) -> str:
    """Classify the product into a high-level policy type."""
    tag_set = set(t.lower() for t in tags)
    age = features.get("age", 30)
    if "senior" in tag_set or age >= 60:
        return "Senior Care"
    if "health" in tag_set or "medical" in tag_set:
        return "Health"
    if "family" in tag_set:
        return "Family Protection"
    if "whole" in tag_set or "whole-life" in tag_set:
        return "Whole Life"
    if "retirement" in tag_set or "investment" in tag_set:
        return "Retirement / Investment"
    if "term" in tag_set or "life" in tag_set:
        return "Term Life"
    return "Life"


# ---------------------------------------------------------------------------
# Affordability score
# ---------------------------------------------------------------------------

def _affordability_score(monthly_premium: float, income: float) -> float:
    """
    Returns a score in [0, 1] — higher means more affordable.
    Based on premium-to-income ratio: ideal < 10% of monthly income.
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
    if ratio <= 0.20:
        return 0.45
    if ratio <= 0.30:
        return 0.25
    return 0.10


# ---------------------------------------------------------------------------
# Lapse probability prediction
# ---------------------------------------------------------------------------

def _lapse_probability(features: dict[str, Any], monthly_premium: float) -> float:
    """
    Heuristic estimate of the probability the policy will lapse.
    Lower income relative to premium → higher lapse risk.
    """
    income = float(features.get("income", features.get("monthlyIncomeLkr", 50000)))
    age = int(features.get("age", 30))
    conditions = features.get("conditions", [])
    smoker = bool(features.get("smoker", False))

    prob = 0.10  # base 10 %
    if income > 0:
        ratio = monthly_premium / income
        if ratio > 0.20:
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
# Core heuristic scoring
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
    dependents = int(features.get("dependents", 0))
    income = float(features.get("income", features.get("monthlyIncomeLkr", 50000)))
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

    score = round(max(0.0, min(1.0, score)), 4)

    # Premium estimate
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
    return {"status": "ok", "service": "ai-engine"}


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest):
    logger.info("Scoring session=%s products=%d", request.sessionId, len(request.products))

    ranked: list[RankedProduct] = []
    for product in request.products:
        s, premium, afford, lapse, pol_type, reasons = _score_product(
            request.features, product, _weights
        )
        ranked.append(
            RankedProduct(
                code=product.code,
                name=product.name,
                policyType=pol_type,
                score=s,
                monthlyPremiumEstimate=premium,
                affordabilityScore=round(afford, 4),
                lapseProbability=lapse,
                reasons=reasons,
            )
        )

    ranked.sort(key=lambda p: p.score, reverse=True)
    return ScoreResponse(sessionId=request.sessionId, rankedProducts=ranked)


@app.post("/train", response_model=TrainResponse)
async def train(file: UploadFile = File(...)):
    """
    Accept a CSV training dataset to update feature weights.
    Expected CSV columns (all optional): age, smoker, dependents, income,
    coverageAmount, conditions_count, outcome_score (0-1 ground truth).
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

    # Compute simple mean adjustments from ground-truth outcome scores
    smoker_scores: list[float] = []
    nonsmoker_scores: list[float] = []
    young_scores: list[float] = []
    old_scores: list[float] = []

    valid_rows = 0
    for row in rows:
        try:
            outcome = float(row.get("outcome_score", row.get("score", 0.5)))
            age = int(row.get("age", 30))
            smoker = str(row.get("smoker", "false")).lower() in ("true", "1", "yes")
            if smoker:
                smoker_scores.append(outcome)
            else:
                nonsmoker_scores.append(outcome)
            if age < 30:
                young_scores.append(outcome)
            elif age > 55:
                old_scores.append(outcome)
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
                "Unexpected pattern: smokers scored higher than non-smokers (diff=%.4f). "
                "Ignoring smoker_penalty update.", diff
            )
        else:
            _weights["smoker_penalty"] = round(min(max(diff, 0.05), 0.40), 4)
            logger.info("Updated smoker_penalty=%.4f from %d rows", _weights["smoker_penalty"], valid_rows)

    if young_scores and old_scores:
        young_avg = sum(young_scores) / len(young_scores)
        old_avg = sum(old_scores) / len(old_scores)
        _weights["age_young_boost"] = round(min(max(young_avg - 0.5, 0.02), 0.25), 4)
        _weights["age_old_penalty"] = round(min(max(0.5 - old_avg, 0.02), 0.30), 4)

    logger.info("Training complete: %d valid rows processed", valid_rows)

    return TrainResponse(
        message=f"Training complete. {valid_rows} rows processed.",
        rowsProcessed=valid_rows,
        updatedWeights=dict(_weights),
    )
