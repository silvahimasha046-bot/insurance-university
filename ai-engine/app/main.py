from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Insurance AI Engine", version="1.0.0")


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
    score: float
    monthlyPremiumEstimate: float
    reasons: list[str]


class ScoreResponse(BaseModel):
    sessionId: str
    rankedProducts: list[RankedProduct]


# ---------------------------------------------------------------------------
# Heuristic scoring helpers
# ---------------------------------------------------------------------------

def _score_product(features: dict[str, Any], product: Product) -> tuple[float, float, list[str]]:
    """
    Deterministic heuristic scoring.  Returns (score, premium_estimate, reasons).
    score is in [0, 1].
    """
    score = 0.5
    reasons: list[str] = []
    tags = [t.lower() for t in (product.tags or [])]

    age = features.get("age", 30)
    smoker = bool(features.get("smoker", False))
    dependents = int(features.get("dependents", 0))
    income = float(features.get("income", 50000))
    coverage = float(features.get("coverageAmount", product.basePremium * 100))

    # Age-based adjustments
    if age < 30:
        score += 0.1
        reasons.append("Young applicant — lower risk")
    elif age > 55:
        score -= 0.15
        reasons.append("Age over 55 — higher risk premium")

    # Smoker penalty
    if smoker:
        score -= 0.2
        reasons.append("Tobacco use increases premium")
    else:
        score += 0.05
        reasons.append("Non-smoker discount applied")

    # Dependents boost for family / life products
    if dependents > 0 and any(t in tags for t in ["life", "family", "term"]):
        score += 0.1 * min(dependents, 3)
        reasons.append(f"{dependents} dependent(s) — family coverage recommended")

    # Income-to-coverage ratio check
    if income > 0:
        ratio = coverage / (income * 12)
        if ratio > 10:
            score -= 0.1
            reasons.append("Coverage amount is very high relative to income")
        elif ratio <= 5:
            score += 0.05
            reasons.append("Affordable coverage-to-income ratio")

    # Penalise ineligible: age hard cap
    if age > 65 and "senior" not in tags:
        score -= 0.3
        reasons.append("Product not designed for applicants over 65")

    # Health conditions
    conditions = features.get("conditions", [])
    if conditions:
        score -= 0.05 * len(conditions)
        reasons.append(f"{len(conditions)} pre-existing condition(s) noted")

    # Clamp score
    score = max(0.0, min(1.0, score))

    # Premium estimate: basePremium adjusted by risk factors
    risk_multiplier = 1.0
    if smoker:
        risk_multiplier += 0.25
    if age > 55:
        risk_multiplier += 0.15
    if conditions:
        risk_multiplier += 0.05 * len(conditions)

    premium_estimate = round(product.basePremium * risk_multiplier, 2)
    return score, premium_estimate, reasons


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
        s, premium, reasons = _score_product(request.features, product)
        ranked.append(
            RankedProduct(
                code=product.code,
                name=product.name,
                score=round(s, 4),
                monthlyPremiumEstimate=premium,
                reasons=reasons,
            )
        )

    # Sort descending by score
    ranked.sort(key=lambda p: p.score, reverse=True)

    return ScoreResponse(sessionId=request.sessionId, rankedProducts=ranked)
