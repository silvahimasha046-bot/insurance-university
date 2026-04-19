from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Any, Optional
import logging
import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Insurance AI Engine", version="2.0.0")

TRAINING_FORMAT_VERSION = "policy-recommendation-v2"
REQUIRED_TRAIN_COLUMNS = {
    "product_code",
    "category_code",
    "subcategory_code",
    "policy_type",
    "eligibility",
    "outcome_score",
    "age",
    "smoker",
    "income",
    "monthlyexpenseslkr",
    "networthlkr",
    "conditions_count",
}

# ---------------------------------------------------------------------------
# In-memory feature weights — updated via /train
# ---------------------------------------------------------------------------
DEFAULT_WEIGHTS: dict[str, float] = {
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

APP_ROOT = Path(__file__).resolve().parent.parent
MODEL_STORE_DIR = APP_ROOT / "data" / "models"
ACTIVE_MODEL_FILE = MODEL_STORE_DIR / "active_model.json"

_weights: dict[str, float] = dict(DEFAULT_WEIGHTS)
_policy_adjustments: dict[str, dict[str, dict[str, Any]]] = {
    "products": {},
    "categories": {},
    "subcategories": {},
    "policyTypes": {},
}
_active_model_meta: Optional[dict[str, Any]] = None

# ---------------------------------------------------------------------------
# Maximum cap on life coverage (system-defined scheme limit)
# ---------------------------------------------------------------------------
MAX_COVERAGE_LKR = 50_000_000  # Rs. 50 million

# Affordability threshold: premium must not exceed this fraction of disposable income
AFFORDABILITY_THRESHOLD = 0.20

# Follow-up prompts become stricter when recommendation confidence is low.
FOLLOW_UP_CONFIDENCE_THRESHOLD = 0.62
FOLLOW_UP_SCORE_GAP_THRESHOLD = 0.12

# Premium calculation defaults
DEFAULT_FALLBACK_BASE_PREMIUM = 1000.0
DEFAULT_TAX_RATE = 0.0


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class Product(BaseModel):
    code: str
    name: str
    basePremium: float
    tags: list[str] = Field(default_factory=list)
    category: Optional[str] = None
    categoryCode: Optional[str] = None
    subCategory: Optional[str] = None
    subCategoryCode: Optional[str] = None
    benefits: Optional[list[dict[str, Any]]] = None
    riders: Optional[list[dict[str, Any]]] = None
    eligibility: Optional[dict[str, Any]] = None
    sampleCalculations: Optional[list[dict[str, Any]]] = None
    paymentModes: Optional[list[str]] = None
    howItWorks: Optional[str] = None
    additionalBenefits: Optional[str] = None
    minEligibleAge: Optional[int] = None
    maxEligibleAge: Optional[int] = None
    minPolicyTermYears: Optional[int] = None
    maxPolicyTermYears: Optional[int] = None


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
    category: Optional[str] = None
    subCategory: Optional[str] = None
    productMetadata: Optional[dict[str, Any]] = None
    premiumExplanation: Optional[dict[str, Any]] = None


class FollowUpQuestion(BaseModel):
    id: str
    key: str
    question: str
    type: str  # text | number | boolean | select
    required: bool = True
    reason: Optional[str] = None
    options: list[str] = Field(default_factory=list)
    relatedPlans: list[str] = Field(default_factory=list)


class ScoreResponse(BaseModel):
    sessionId: str
    rankedProducts: list[RankedProduct]
    followUpQuestions: list[FollowUpQuestion] = Field(default_factory=list)


class TrainResponse(BaseModel):
    message: str
    rowsProcessed: int
    updatedWeights: dict[str, float]
    skippedRows: int = 0
    modelArtifactId: str
    modelName: str
    trainingFormat: str


class ModelActivationResponse(BaseModel):
    message: str
    artifactId: str
    modelName: str


def _default_policy_adjustments() -> dict[str, dict[str, dict[str, Any]]]:
    return {
        "products": {},
        "categories": {},
        "subcategories": {},
        "policyTypes": {},
        "childrenCountBuckets": {},
        "childrenAgeBuckets": {},
        "educationPurpose": {},
    }


def _ensure_model_store() -> None:
    MODEL_STORE_DIR.mkdir(parents=True, exist_ok=True)


def _artifact_path(artifact_id: str) -> Path:
    return MODEL_STORE_DIR / f"{artifact_id}.json"


def _normalize_key(value: Any, uppercase: bool = False) -> str:
    text = str(value or "").strip()
    return text.upper() if uppercase else text.lower()


def _average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _summarize_adjustments(grouped_scores: dict[str, list[float]], overall_avg: float) -> dict[str, dict[str, Any]]:
    summary: dict[str, dict[str, Any]] = {}
    for key, scores in grouped_scores.items():
        if not key or not scores:
            continue
        avg_outcome = round(_average(scores), 4)
        summary[key] = {
            "avgOutcome": avg_outcome,
            "sampleCount": len(scores),
            "delta": round(max(min(avg_outcome - overall_avg, 0.25), -0.25), 4),
        }
    return summary


def _persist_model_artifact(artifact: dict[str, Any]) -> None:
    _ensure_model_store()
    _artifact_path(artifact["artifactId"]).write_text(json.dumps(artifact, indent=2), encoding="utf-8")


def _load_model_artifact(artifact_id: str) -> dict[str, Any]:
    artifact_file = _artifact_path(artifact_id)
    if not artifact_file.exists():
        raise HTTPException(status_code=404, detail=f"Model artifact '{artifact_id}' not found")
    return json.loads(artifact_file.read_text(encoding="utf-8"))


def _apply_model_artifact(artifact: dict[str, Any], persist_active: bool = False) -> None:
    global _weights, _policy_adjustments, _active_model_meta

    _weights = dict(DEFAULT_WEIGHTS)
    _weights.update({k: float(v) for k, v in artifact.get("weights", {}).items()})
    _policy_adjustments = _default_policy_adjustments()
    for group_name, group_values in artifact.get("policyAdjustments", {}).items():
        if group_name in _policy_adjustments and isinstance(group_values, dict):
            _policy_adjustments[group_name] = group_values

    _active_model_meta = {
        "artifactId": artifact.get("artifactId"),
        "modelName": artifact.get("modelName", "Unnamed Model"),
        "trainedAt": artifact.get("trainedAt"),
        "trainingFormat": artifact.get("trainingFormat", TRAINING_FORMAT_VERSION),
    }

    if persist_active:
        _ensure_model_store()
        ACTIVE_MODEL_FILE.write_text(
            json.dumps(
                {
                    "artifactId": artifact.get("artifactId"),
                    "modelName": artifact.get("modelName", "Unnamed Model"),
                    "trainedAt": artifact.get("trainedAt"),
                },
                indent=2,
            ),
            encoding="utf-8",
        )


def _initialize_active_model() -> None:
    global _weights, _policy_adjustments, _active_model_meta

    _ensure_model_store()
    _weights = dict(DEFAULT_WEIGHTS)
    _policy_adjustments = _default_policy_adjustments()
    _active_model_meta = {
        "artifactId": "default-heuristic-model",
        "modelName": "Default Heuristic Model",
        "trainedAt": None,
        "trainingFormat": "built-in-default",
    }

    if not ACTIVE_MODEL_FILE.exists():
        return

    try:
        active_ref = json.loads(ACTIVE_MODEL_FILE.read_text(encoding="utf-8"))
        artifact_id = active_ref.get("artifactId")
        if artifact_id:
            _apply_model_artifact(_load_model_artifact(artifact_id), persist_active=False)
            logger.info("Loaded active AI model artifact=%s", artifact_id)
    except Exception as exc:
        logger.warning("Failed to load active AI model. Using defaults. error=%s", exc)


@app.on_event("startup")
def on_startup() -> None:
    _initialize_active_model()


def _parse_children_ages(value: Any) -> list[int]:
    if value is None:
        return []
    raw = str(value).strip()
    if not raw or raw.upper() == "NONE":
        return []

    normalized = raw.replace("|", ",")
    ages: list[int] = []
    for token in normalized.split(","):
        piece = token.strip()
        if not piece:
            continue
        if piece.lstrip("-").isdigit():
            age = int(piece)
            if 0 <= age <= 30:
                ages.append(age)
    return ages


def _children_count_bucket(count: int) -> str:
    if count <= 0:
        return "0"
    if count == 1:
        return "1"
    if count == 2:
        return "2"
    return "3+"


def _children_age_buckets(ages: list[int]) -> set[str]:
    buckets: set[str] = set()
    for age in ages:
        if age <= 5:
            buckets.add("0-5")
        elif age <= 12:
            buckets.add("6-12")
        elif age <= 17:
            buckets.add("13-17")
        else:
            buckets.add("18+")
    return buckets


def _learned_policy_adjustment(product: Product, policy_type: str, features: dict[str, Any]) -> tuple[float, list[str]]:
    adjustments: list[float] = []
    reasons: list[str] = []

    product_code = _normalize_key(product.code, uppercase=True)
    category_code = _normalize_key(product.categoryCode, uppercase=True)
    subcategory_code = _normalize_key(product.subCategoryCode, uppercase=True)
    policy_type_key = _normalize_key(policy_type)

    exact_product = _policy_adjustments["products"].get(product_code)
    if exact_product:
        adjustments.append(exact_product.get("delta", 0.0) * 0.55)
        reasons.append(
            f"Trained uplift from {exact_product.get('sampleCount', 0)} historical outcome(s) for {product.name}"
        )

    category_adj = _policy_adjustments["categories"].get(category_code)
    if category_adj:
        adjustments.append(category_adj.get("delta", 0.0) * 0.18)

    subcategory_adj = _policy_adjustments["subcategories"].get(subcategory_code)
    if subcategory_adj:
        adjustments.append(subcategory_adj.get("delta", 0.0) * 0.15)

    policy_type_adj = _policy_adjustments["policyTypes"].get(policy_type_key)
    if policy_type_adj:
        adjustments.append(policy_type_adj.get("delta", 0.0) * 0.12)

    # Child-aware trained adjustments (when child features are available)
    dependents = int(features.get("dependents", features.get("memberCount", 0)) or 0)
    children_ages = _parse_children_ages(features.get("childrenAges"))
    child_count = dependents if dependents > 0 else len(children_ages)

    count_bucket = _children_count_bucket(child_count)
    count_adj = _policy_adjustments["childrenCountBuckets"].get(count_bucket)
    if count_adj:
        adjustments.append(count_adj.get("delta", 0.0) * 0.10)

    for bucket in _children_age_buckets(children_ages):
        age_adj = _policy_adjustments["childrenAgeBuckets"].get(bucket)
        if age_adj:
            adjustments.append(age_adj.get("delta", 0.0) * 0.08)

    purpose = _normalize_key(features.get("protectionPurpose"))
    if purpose == "educationfunding":
        education_adj = _policy_adjustments["educationPurpose"].get("educationfunding")
        if education_adj:
            adjustments.append(education_adj.get("delta", 0.0) * 0.10)
            if child_count > 0:
                reasons.append(f"Education funding fit based on child profile ({child_count} dependent(s))")

    total_adjustment = round(max(min(sum(adjustments), 0.25), -0.25), 4)
    if total_adjustment == 0:
        reasons = []

    return total_adjustment, reasons


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

def _classify_policy_type(
    tags: list[str],
    features: dict[str, Any],
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> str:
    """Classify the product into Life, Retirement, Investment, or Critical Illness."""
    tag_set = set(t.lower() for t in tags)
    category_name = (category or "").lower()
    sub_category_name = (sub_category or "").lower()
    age = int(features.get("age", 30))
    protection_purpose = features.get("protectionPurpose", "")
    priority_equity = int(features.get("priorityEquity", 3))
    priority_safety = int(features.get("prioritySafety", 3))

    if "life" in category_name or "protection" in sub_category_name:
        return "Life"
    if "retirement" in category_name:
        return "Retirement"
    if "investment" in category_name:
        return "Investment"
    if "medical" in category_name:
        return "Critical Illness"

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


def _build_product_metadata(product: Product) -> Optional[dict[str, Any]]:
    metadata: dict[str, Any] = {}
    if product.category:
        metadata["category"] = product.category
    if product.subCategory:
        metadata["subCategory"] = product.subCategory
    if product.benefits is not None:
        metadata["benefits"] = product.benefits
    if product.riders is not None:
        metadata["riders"] = product.riders
    if product.eligibility is not None:
        metadata["eligibility"] = product.eligibility
    if product.sampleCalculations is not None:
        metadata["sampleCalculations"] = product.sampleCalculations
    if product.paymentModes is not None:
        metadata["paymentModes"] = product.paymentModes
    if product.howItWorks:
        metadata["howItWorks"] = product.howItWorks
    if product.additionalBenefits:
        metadata["additionalBenefits"] = product.additionalBenefits
    if product.minEligibleAge is not None:
        metadata["minEligibleAge"] = product.minEligibleAge
    if product.maxEligibleAge is not None:
        metadata["maxEligibleAge"] = product.maxEligibleAge
    if product.minPolicyTermYears is not None:
        metadata["minPolicyTermYears"] = product.minPolicyTermYears
    if product.maxPolicyTermYears is not None:
        metadata["maxPolicyTermYears"] = product.maxPolicyTermYears
    return metadata if metadata else None


def _metadata_reasons(product: Product) -> list[str]:
    reasons: list[str] = []
    if product.category:
        reasons.append(f"Mapped under {product.category}")
    if product.subCategory:
        reasons.append(f"Subcategory fit: {product.subCategory}")
    if product.minEligibleAge is not None and product.maxEligibleAge is not None:
        reasons.append(
            f"Typical eligibility age range {product.minEligibleAge}-{product.maxEligibleAge}"
        )
    return reasons


def _is_missing(features: dict[str, Any], key: str) -> bool:
    value = features.get(key)
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def _build_follow_up_questions(features: dict[str, Any], ranked: list[RankedProduct]) -> list[FollowUpQuestion]:
    top_plan_names = [p.name for p in ranked[:3]]
    questions: list[FollowUpQuestion] = []

    top_score = ranked[0].score if ranked else 0.0
    second_score = ranked[1].score if len(ranked) > 1 else 0.0
    score_gap = top_score - second_score
    low_confidence = (
        top_score < FOLLOW_UP_CONFIDENCE_THRESHOLD
        or score_gap < FOLLOW_UP_SCORE_GAP_THRESHOLD
    )

    # Always ask critical underwriting and affordability inputs.
    if _is_missing(features, "age"):
        questions.append(FollowUpQuestion(
            id="age_required",
            key="age",
            question="What is your current age?",
            type="number",
            reason="Age is required for underwriting eligibility and pricing.",
            relatedPlans=top_plan_names,
        ))

    if _is_missing(features, "monthlyIncomeLkr") and _is_missing(features, "income"):
        questions.append(FollowUpQuestion(
            id="income_required",
            key="monthlyIncomeLkr",
            question="What is your monthly income (LKR)?",
            type="number",
            reason="Income is needed to evaluate affordability and lapse risk.",
            relatedPlans=top_plan_names,
        ))

    if _is_missing(features, "monthlyExpensesLkr"):
        questions.append(FollowUpQuestion(
            id="expenses_required",
            key="monthlyExpensesLkr",
            question="What are your monthly expenses (LKR)?",
            type="number",
            reason="Expenses improve coverage and affordability calculations.",
            relatedPlans=top_plan_names,
        ))

    if _is_missing(features, "smoker") and _is_missing(features, "tobaccoUse"):
        questions.append(FollowUpQuestion(
            id="smoker_required",
            key="smoker",
            question="Do you currently use tobacco products?",
            type="boolean",
            reason="Smoking status affects underwriting decisions and premium loading.",
            relatedPlans=top_plan_names,
        ))

    # Ask optional plan-shaping questions only when model confidence is low.
    if _is_missing(features, "protectionPurpose") and low_confidence:
        questions.append(FollowUpQuestion(
            id="purpose_required",
            key="protectionPurpose",
            question="What is your main protection purpose?",
            type="select",
            options=["SurvivorIncome", "EducationFunding", "RetirementSupplement", "EstateLiquidity"],
            reason="Protection purpose determines the recommended coverage strategy.",
            relatedPlans=top_plan_names,
        ))

    top_subcategories = {str((p.subCategory or "")).lower() for p in ranked[:3]}
    top_policy_types = {str((p.policyType or "")).lower() for p in ranked[:3]}
    education_sensitive = (
        "educationfunding" == str(features.get("protectionPurpose", "")).strip().lower()
        or any("education" in sub for sub in top_subcategories)
        or "life" in top_policy_types
    )

    if _is_missing(features, "childrenAges") and education_sensitive:
        questions.append(FollowUpQuestion(
            id="children_ages_required",
            key="childrenAges",
            question="Enter your children ages separated by commas (e.g. 5, 9).",
            type="text",
            reason="Education funding projections require children age details.",
            relatedPlans=top_plan_names,
        ))

    protection_keywords = ["protection", "endowment", "advanced", "smart", "supreme", "saubhagya"]
    if any(any(k in sub for k in protection_keywords) for sub in top_subcategories) and low_confidence:
        if _is_missing(features, "desiredPolicyTermYears"):
            questions.append(FollowUpQuestion(
                id="policy_term_required",
                key="desiredPolicyTermYears",
                question="Preferred policy term in years?",
                type="number",
                reason="Protection plans vary heavily by term length.",
                relatedPlans=top_plan_names,
            ))
        if _is_missing(features, "desiredSumAssured"):
            questions.append(FollowUpQuestion(
                id="sum_assured_required",
                key="desiredSumAssured",
                question="Desired sum assured amount (LKR)?",
                type="number",
                reason="Sum assured preference helps select a suitable life protection plan.",
                relatedPlans=top_plan_names,
            ))

    return questions


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
    children_ages = _parse_children_ages(features.get("childrenAges", ""))

    if protection_purpose == "EducationFunding":
        # Calculate years until youngest child reaches 21
        if children_ages:
            youngest = min(children_ages)
            years_remaining = max(0, 21 - youngest)
            if years_remaining > 0:
                coverage = monthly_expenses * 12 * years_remaining
                return round(min(coverage, MAX_COVERAGE_LKR), 0)
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


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_selected_rider_keys(features: dict[str, Any]) -> set[str]:
    selected = features.get("selectedRiders", features.get("selectedRiderCodes", []))
    keys: set[str] = set()
    if not isinstance(selected, list):
        return keys

    for item in selected:
        if isinstance(item, str) and item.strip():
            keys.add(item.strip().lower())
            continue
        if isinstance(item, dict):
            code = str(item.get("code", "")).strip().lower()
            name = str(item.get("name", "")).strip().lower()
            if code:
                keys.add(code)
            if name:
                keys.add(name)
    return keys


def _calculate_monthly_premium(
    features: dict[str, Any], product: Product, w: dict[str, float]
) -> tuple[float, dict[str, Any]]:
    age = int(features.get("age", 30))
    smoker = bool(features.get("smoker", False))
    conditions = features.get("conditions", [])
    condition_count = len(conditions) if isinstance(conditions, list) else 0
    occupation_hazard = int(features.get("occupationHazardLevel", 1) or 1)

    coverage = _to_float(
        features.get("coverageAmount", features.get("desiredSumAssured", 0.0)),
        0.0,
    )
    if coverage <= 0:
        coverage = max(product.basePremium * 100.0, 1_000_000.0)

    base_premium = product.basePremium
    used_fallback_base = False
    if base_premium <= 0:
        used_fallback_base = True
        base_premium = DEFAULT_FALLBACK_BASE_PREMIUM

    # Scale legacy base premium by requested coverage with a 1M baseline.
    coverage_factor = max(coverage / 1_000_000.0, 0.25)
    coverage_component = base_premium * coverage_factor

    risk_multiplier = 1.0
    risk_breakdown: dict[str, float] = {}
    if smoker:
        risk_breakdown["smoker"] = w["smoker_risk_pct"]
        risk_multiplier += w["smoker_risk_pct"]
    if age > 55:
        risk_breakdown["ageOver55"] = w["age_old_risk_pct"]
        risk_multiplier += w["age_old_risk_pct"]
    if condition_count > 0:
        condition_load = w["condition_risk_pct"] * condition_count
        risk_breakdown["conditions"] = condition_load
        risk_multiplier += condition_load
    if occupation_hazard >= 4:
        occupation_load = 0.05 * min(occupation_hazard, 5)
        risk_breakdown["occupationHazard"] = occupation_load
        risk_multiplier += occupation_load

    premium_after_risk = coverage_component * risk_multiplier

    selected_riders = _extract_selected_rider_keys(features)
    rider_premium_total = 0.0
    rider_breakdown: list[dict[str, Any]] = []
    if selected_riders and product.riders:
        for rider in product.riders:
            if not isinstance(rider, dict):
                continue
            rider_code = str(rider.get("code", "")).strip()
            rider_name = str(rider.get("name", "")).strip()
            rider_key_code = rider_code.lower()
            rider_key_name = rider_name.lower()
            if rider_key_code not in selected_riders and rider_key_name not in selected_riders:
                continue

            rider_base = _to_float(
                rider.get("monthlyPremium", rider.get("premium", rider.get("basePremium", 0.0))),
                0.0,
            )
            if rider_base <= 0:
                rider_base = max(base_premium * 0.03, 50.0)
            rider_cost = rider_base * risk_multiplier
            rider_premium_total += rider_cost
            rider_breakdown.append(
                {
                    "code": rider_code,
                    "name": rider_name,
                    "base": round(rider_base, 2),
                    "adjusted": round(rider_cost, 2),
                }
            )

    sub_total = premium_after_risk + rider_premium_total
    tax_rate = _to_float(features.get("taxRate"), DEFAULT_TAX_RATE)
    tax_rate = max(0.0, min(tax_rate, 1.0))
    tax_amount = sub_total * tax_rate
    final_monthly = round(sub_total + tax_amount, 2)

    explanation = {
        "coverageAmount": round(coverage, 2),
        "basePremiumUsed": round(base_premium, 2),
        "usedFallbackBasePremium": used_fallback_base,
        "coverageFactor": round(coverage_factor, 4),
        "coverageComponent": round(coverage_component, 2),
        "riskMultiplier": round(risk_multiplier, 4),
        "riskBreakdown": {k: round(v, 4) for k, v in risk_breakdown.items()},
        "premiumAfterRisk": round(premium_after_risk, 2),
        "selectedRiderCount": len(rider_breakdown),
        "selectedRiderPremium": round(rider_premium_total, 2),
        "riderBreakdown": rider_breakdown,
        "subTotal": round(sub_total, 2),
        "taxRate": round(tax_rate, 4),
        "taxAmount": round(tax_amount, 2),
    }

    return final_monthly, explanation


# ---------------------------------------------------------------------------
# Core heuristic scoring (enhanced with collaborative filtering)
# ---------------------------------------------------------------------------

def _score_product(
    features: dict[str, Any], product: Product, w: dict[str, float]
) -> tuple[float, float, float, float, str, list[str], dict[str, Any]]:
    """Returns (score, premium_estimate, affordability, lapse_prob, policy_type, reasons, premium_explanation)."""
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

    policy_type = _classify_policy_type(tags, features, product.category, product.subCategory)

    learned_delta, learned_reasons = _learned_policy_adjustment(product, policy_type, features)
    if learned_delta != 0:
        score += learned_delta
        reasons.extend(learned_reasons)

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

    premium_estimate, premium_explanation = _calculate_monthly_premium(features, product, w)

    if premium_explanation.get("usedFallbackBasePremium"):
        reasons.append("Base premium unavailable - temporary fallback applied")

    affordability = _affordability_score(premium_estimate, income)
    lapse_prob = _lapse_probability(features, premium_estimate)

    return score, premium_estimate, affordability, lapse_prob, policy_type, reasons, premium_explanation


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-engine",
        "version": "2.0.0",
        "activeModel": _active_model_meta,
    }


@app.post("/models/{artifact_id}/activate", response_model=ModelActivationResponse)
def activate_model(artifact_id: str):
    artifact = _load_model_artifact(artifact_id)
    _apply_model_artifact(artifact, persist_active=True)
    return ModelActivationResponse(
        message=f"Activated model '{artifact.get('modelName', artifact_id)}'",
        artifactId=artifact_id,
        modelName=artifact.get("modelName", artifact_id),
    )


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest):
    logger.info("Scoring session=%s products=%d", request.sessionId, len(request.products))

    normalized_features = dict(request.features)
    if (
        normalized_features.get("smoker") is None
        and isinstance(normalized_features.get("tobaccoUse"), bool)
    ):
        normalized_features["smoker"] = normalized_features["tobaccoUse"]

    # Step 1: CART underwriting
    eligibility_decision, base_exclusions = _run_cart_underwriting(normalized_features)
    rider_exclusions = _get_rider_exclusions(normalized_features, base_exclusions)

    # Step 3: Predict coverage
    predicted_coverage = _predict_coverage(normalized_features)

    ranked: list[RankedProduct] = []
    for product in request.products:
        s, premium, afford, lapse, pol_type, reasons, premium_explanation = _score_product(
            normalized_features, product, _weights
        )
        reasons.extend(_metadata_reasons(product))
        product_metadata = _build_product_metadata(product)

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
                category=product.category,
                subCategory=product.subCategory,
                productMetadata=product_metadata,
                premiumExplanation=premium_explanation,
            )
        )

    ranked.sort(key=lambda p: p.score, reverse=True)
    # Assign suitability ranks
    for idx, p in enumerate(ranked):
        p.suitabilityRank = idx + 1

    follow_up_questions = _build_follow_up_questions(normalized_features, ranked)

    return ScoreResponse(
        sessionId=request.sessionId,
        rankedProducts=ranked,
        followUpQuestions=follow_up_questions,
    )


@app.post("/train", response_model=TrainResponse)
async def train(file: UploadFile = File(...)):
    """
    Accept a policy recommendation outcome CSV to update feature weights and
    product-linked adjustments that influence future predictions.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Invalid training CSV: header row is missing")

    normalized_headers = {
        str(name).strip().replace("\ufeff", "").strip('"').lower()
        for name in reader.fieldnames
        if name is not None
    }
    missing_headers = sorted(REQUIRED_TRAIN_COLUMNS - normalized_headers)
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Invalid training CSV for {TRAINING_FORMAT_VERSION}: missing required header column(s).",
                "missingColumns": missing_headers,
            },
        )

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
    outcome_scores: list[float] = []
    product_scores: dict[str, list[float]] = {}
    category_scores: dict[str, list[float]] = {}
    subcategory_scores: dict[str, list[float]] = {}
    policy_type_scores: dict[str, list[float]] = {}
    children_count_scores: dict[str, list[float]] = {}
    children_age_bucket_scores: dict[str, list[float]] = {}
    education_purpose_scores: dict[str, list[float]] = {}

    valid_rows = 0
    skipped_rows = 0
    for row in rows:
        try:
            outcome = float(row.get("outcome_score", row.get("score", 0.5)))
            age = int(row.get("age", 30))
            smoker = str(row.get("smoker", "false")).lower() in ("true", "1", "yes")
            policy_type = str(row.get("policy_type", "")).lower()
            eligibility = str(row.get("eligibility", "eligible")).lower()
            product_code = _normalize_key(row.get("product_code"), uppercase=True)
            category_code = _normalize_key(row.get("category_code"), uppercase=True)
            subcategory_code = _normalize_key(row.get("subcategory_code"), uppercase=True)
            protection_purpose = _normalize_key(row.get("protection_purpose"))

            children_count_raw = str(row.get("children_count", "")).strip()
            children_count = int(children_count_raw) if children_count_raw else 0
            children_ages = _parse_children_ages(row.get("children_ages_csv", ""))
            if children_count <= 0 and children_ages:
                children_count = len(children_ages)

            outcome = max(0.0, min(outcome, 1.0))
            outcome_scores.append(outcome)

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

            if product_code:
                product_scores.setdefault(product_code, []).append(outcome)
            if category_code:
                category_scores.setdefault(category_code, []).append(outcome)
            if subcategory_code:
                subcategory_scores.setdefault(subcategory_code, []).append(outcome)
            if policy_type:
                policy_type_scores.setdefault(policy_type, []).append(outcome)

            count_bucket = _children_count_bucket(children_count)
            children_count_scores.setdefault(count_bucket, []).append(outcome)

            for bucket in _children_age_buckets(children_ages):
                children_age_bucket_scores.setdefault(bucket, []).append(outcome)

            if protection_purpose == "educationfunding" or "education" in policy_type:
                education_purpose_scores.setdefault("educationfunding", []).append(outcome)

            valid_rows += 1
        except (ValueError, TypeError):
            skipped_rows += 1
            continue

    if valid_rows == 0:
        raise HTTPException(status_code=400, detail="CSV file does not contain any valid training rows")

    trained_weights = dict(DEFAULT_WEIGHTS)

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
            trained_weights["smoker_penalty"] = round(min(max(diff, 0.05), 0.40), 4)

    if young_scores and old_scores:
        young_avg = sum(young_scores) / len(young_scores)
        old_avg = sum(old_scores) / len(old_scores)
        trained_weights["age_young_boost"] = round(min(max(young_avg - 0.5, 0.02), 0.25), 4)
        trained_weights["age_old_penalty"] = round(min(max(0.5 - old_avg, 0.02), 0.30), 4)

    if invest_scores and protect_scores:
        invest_avg = sum(invest_scores) / len(invest_scores)
        protect_avg = sum(protect_scores) / len(protect_scores)
        if invest_avg > protect_avg:
            trained_weights["postgrad_invest_boost"] = round(
                min(trained_weights["postgrad_invest_boost"] + 0.01, 0.25), 4
            )
        else:
            trained_weights["high_expense_protection"] = round(
                min(trained_weights["high_expense_protection"] + 0.01, 0.25), 4
            )

    overall_avg = round(_average(outcome_scores), 4)
    policy_adjustments = {
        "products": _summarize_adjustments(product_scores, overall_avg),
        "categories": _summarize_adjustments(category_scores, overall_avg),
        "subcategories": _summarize_adjustments(subcategory_scores, overall_avg),
        "policyTypes": _summarize_adjustments(policy_type_scores, overall_avg),
        "childrenCountBuckets": _summarize_adjustments(children_count_scores, overall_avg),
        "childrenAgeBuckets": _summarize_adjustments(children_age_bucket_scores, overall_avg),
        "educationPurpose": _summarize_adjustments(education_purpose_scores, overall_avg),
    }

    artifact_id = f"model-{uuid4().hex[:12]}"
    model_name = f"Policy Outcome Model {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
    artifact = {
        "artifactId": artifact_id,
        "modelName": model_name,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "trainingFormat": TRAINING_FORMAT_VERSION,
        "sourceFilename": file.filename,
        "rowsProcessed": valid_rows,
        "skippedRows": skipped_rows,
        "noOfferRows": no_offer_count,
        "weights": trained_weights,
        "policyAdjustments": policy_adjustments,
        "summary": {
            "overallAverageOutcome": overall_avg,
            "productSamples": len(policy_adjustments["products"]),
            "categorySamples": len(policy_adjustments["categories"]),
            "subcategorySamples": len(policy_adjustments["subcategories"]),
            "policyTypeSamples": len(policy_adjustments["policyTypes"]),
            "childrenCountBuckets": len(policy_adjustments["childrenCountBuckets"]),
            "childrenAgeBuckets": len(policy_adjustments["childrenAgeBuckets"]),
        },
    }
    _persist_model_artifact(artifact)

    logger.info(
        "Training complete: %d valid rows, %d skipped rows, %d no-offer rows. Artifact=%s",
        valid_rows, skipped_rows, no_offer_count, artifact_id
    )

    return TrainResponse(
        message=(
            f"Training complete. {valid_rows} policy outcome rows processed and {skipped_rows} row(s) skipped. "
            f"Promote the generated model to apply it to future predictions."
        ),
        rowsProcessed=valid_rows,
        updatedWeights=trained_weights,
        skippedRows=skipped_rows,
        modelArtifactId=artifact_id,
        modelName=model_name,
        trainingFormat=TRAINING_FORMAT_VERSION,
    )


# ---------------------------------------------------------------------------
# Open Chat — Agentic AI endpoints
# ---------------------------------------------------------------------------

from app.chat.models import ChatRequest, ChatResponse, ChatMessage as ChatMsg
from app.chat.agent import stream_agent_response, get_agent_response
from app.chat.memory import clear_user_memory


async def _sse_generator(user_id: str, session_id: str, message: str, history: list[ChatMsg]):
    """Yield SSE-formatted lines from the agent stream."""
    try:
        async for event in stream_agent_response(user_id, session_id, message, history):
            event_type = event["event"]
            data_json = json.dumps(event["data"], ensure_ascii=False)
            yield f"event: {event_type}\ndata: {data_json}\n\n"
    except Exception as exc:
        logger.error("SSE stream error: %s", exc, exc_info=True)
        yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream an agentic chat response via Server-Sent Events."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    return StreamingResponse(
        _sse_generator(
            request.user_id,
            request.session_id,
            request.message,
            request.conversation_history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat/message", response_model=ChatResponse)
async def chat_message(request: ChatRequest):
    """Non-streaming agentic chat — returns the full response as JSON."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = await get_agent_response(
        request.user_id,
        request.session_id,
        request.message,
        request.conversation_history,
    )
    return ChatResponse(
        sessionId=result["sessionId"],
        reply=result["reply"],
        tokensUsed=result["tokensUsed"],
        toolsInvoked=result["toolsInvoked"],
    )


@app.delete("/chat/memory/{user_id}")
def delete_chat_memory(user_id: str):
    """Clear long-term conversation memory for a user."""
    clear_user_memory(user_id)
    return {"message": f"Memory cleared for user {user_id}"}


@app.get("/chat/health")
def chat_health():
    """Health check for the open-chat subsystem."""
    from app.chat.config import chat_config as cc
    return {
        "status": "ok",
        "model": cc.GROQ_MODEL,
        "hasApiKey": bool(cc.GROQ_API_KEY),
        "faissDataDir": cc.FAISS_DATA_DIR,
    }

