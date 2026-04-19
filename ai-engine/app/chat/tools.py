"""Agentic tool definitions and executors.

Each tool is defined as an OpenAI-compatible function schema and has
a corresponding Python executor function.
"""

from __future__ import annotations

import json
import logging
import math
import httpx
from typing import Any

from simpleeval import simple_eval

from .config import chat_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI function-calling schemas (Groq uses the same format)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "insurance_knowledge_base",
            "description": (
                "Query the Insurance University knowledge base for products, "
                "rules, and pricing information. Use this when the user asks "
                "about available insurance products, policy details, eligibility "
                "rules, or pricing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query_type": {
                        "type": "string",
                        "enum": ["products", "rules", "pricing", "categories"],
                        "description": "The type of data to query.",
                    },
                    "search_term": {
                        "type": "string",
                        "description": "Optional keyword to filter results.",
                    },
                },
                "required": ["query_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "database_query",
            "description": (
                "Run a structured query against the insurance database. "
                "Supports listing products, viewing product details, listing "
                "categories, and searching. Use for specific data lookups."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query_type": {
                        "type": "string",
                        "enum": [
                            "list_products",
                            "product_details",
                            "list_rules",
                            "search_products",
                            "list_categories",
                            "list_pricing_tables",
                        ],
                        "description": "Predefined query to run.",
                    },
                    "product_id": {
                        "type": "integer",
                        "description": "Product ID (for product_details).",
                    },
                    "search_term": {
                        "type": "string",
                        "description": "Search keyword (for search_products).",
                    },
                },
                "required": ["query_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the internet for general knowledge, recent news, "
                "regulations, or any topic the user asks about. Use when "
                "the question is outside the insurance knowledge base."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query.",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results (default 5).",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": (
                "Evaluate a mathematical expression. Use for arithmetic, "
                "percentages, compound interest, or any financial calculation. "
                "Supports: +, -, *, /, **, %, sqrt, abs, round, min, max."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression to evaluate, e.g. '150000 * 0.15' or 'sqrt(144)'.",
                    },
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "policy_scoring",
            "description": (
                "Score insurance products against a user profile to find "
                "the best matches. Call this when you have gathered enough "
                "profile information from the user (at minimum: age, income, "
                "and health status). The more fields provided, the more "
                "accurate the recommendations."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "needs_text": {"type": "string", "description": "User's description of their insurance needs."},
                    "is_pep": {"type": "string", "description": "Whether the user is a Politically Exposed Person. true or false."},
                    "has_criminal_history": {"type": "string", "description": "Whether the user has criminal history. true or false."},
                    "education_level": {
                        "type": "string",
                        "enum": ["Postgrad", "Undergrad", "College", "HighSchool", "Elementary"],
                        "description": "Highest education level.",
                    },
                    "occupation": {"type": "string", "description": "User's occupation / job title."},
                    "occupation_hazard_level": {"type": "string", "description": "Occupational risk level, 1 (low) to 5 (high). Send as number string."},
                    "age": {"type": "string", "description": "User's current age as a number string, e.g. '35'."},
                    "monthly_income": {"type": "string", "description": "Monthly income in LKR as a number string, e.g. '250000'."},
                    "monthly_expenses": {"type": "string", "description": "Monthly expenses in LKR as a number string."},
                    "net_worth": {"type": "string", "description": "Total net worth in LKR as a number string."},
                    "liquid_net_worth": {"type": "string", "description": "Liquid net worth in LKR as a number string."},
                    "target_premium_range": {"type": "string", "description": "Budget range e.g. '5000-10000'."},
                    "premium_payment_years": {"type": "string", "description": "'AllYears' or 'Limited'."},
                    "preferred_payment_mode": {
                        "type": "string",
                        "enum": ["Monthly", "Quarterly", "HalfYearly", "Yearly", "Single"],
                        "description": "Preferred premium payment frequency.",
                    },
                    "loans_text": {"type": "string", "description": "Details about existing loans."},
                    "dependents": {"type": "string", "description": "Number of dependents / family members as a number string."},
                    "children_ages": {"type": "string", "description": "Comma-separated children ages e.g. '5, 9, 12'."},
                    "protection_purpose": {
                        "type": "string",
                        "enum": ["SurvivorIncome", "EducationFunding", "RetirementSupplement", "EstateLiquidity"],
                        "description": "Primary purpose for seeking insurance protection.",
                    },
                    "desired_policy_term_years": {"type": "string", "description": "Desired policy duration in years as a number string."},
                    "desired_sum_assured": {"type": "string", "description": "Target coverage amount in LKR as a number string."},
                    "priority_safety": {"type": "string", "description": "Safety priority 1-5 (default 3) as a number string."},
                    "priority_flexibility": {"type": "string", "description": "Flexibility priority 1-5 (default 3) as a number string."},
                    "priority_equity": {"type": "string", "description": "Equity/investment priority 1-5 (default 3) as a number string."},
                    "priority_certainty": {"type": "string", "description": "Certainty priority 1-5 (default 3) as a number string."},
                    "priority_premium_level": {"type": "string", "description": "Low-premium priority 1-5 (default 3) as a number string."},
                    "health": {
                        "type": "string",
                        "enum": ["excellent", "good", "average", "poor"],
                        "description": "Overall health status.",
                    },
                    "is_smoker": {"type": "string", "description": "Whether the user smokes or uses tobacco. true or false."},
                    "conditions": {"type": "string", "description": "Comma-separated list of pre-existing medical conditions."},
                    "heart_disease": {"type": "string", "description": "Has heart disease. true or false."},
                    "cancer": {"type": "string", "description": "Has cancer. true or false."},
                    "stroke": {"type": "string", "description": "Has had a stroke. true or false."},
                    "other_organ_issues": {"type": "string", "description": "Has other organ issues. true or false."},
                    "hospitalization_5yrs": {"type": "string", "description": "Hospitalized in the last 5 years. true or false."},
                    "family_history": {"type": "string", "description": "Family history of major illness. true or false."},
                    "hazardous_pursuits": {"type": "string", "description": "Engages in hazardous hobbies/sports. true or false."},
                    "flying_activity": {"type": "string", "description": "Non-scheduled flying activity. true or false."},
                },
                "required": ["age", "monthly_income"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool executors
# ---------------------------------------------------------------------------

def _get_db_connection():
    """Create a short-lived MySQL connection for read-only queries."""
    import mysql.connector
    return mysql.connector.connect(
        host=chat_config.MYSQL_HOST,
        port=chat_config.MYSQL_PORT,
        user=chat_config.MYSQL_USER,
        password=chat_config.MYSQL_PASSWORD,
        database=chat_config.MYSQL_DATABASE,
        connect_timeout=5,
    )


def _db_query(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a read-only parameterised query and return rows as dicts."""
    conn = _get_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()
        # Convert non-serialisable types
        result = []
        for row in rows:
            clean = {}
            for k, v in row.items():
                if isinstance(v, (bytes, bytearray)):
                    clean[k] = v.decode("utf-8", errors="replace")
                elif hasattr(v, "isoformat"):
                    clean[k] = v.isoformat()
                else:
                    clean[k] = v
            result.append(clean)
        return result
    finally:
        conn.close()


def _safe_json_parse(value, default):
    """Safely parse a JSON string, returning default on failure."""
    if not value:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _to_int(v, default=0):
    """Coerce a value to int (LLMs sometimes send strings)."""
    if isinstance(v, int) and not isinstance(v, bool):
        return v
    try:
        return int(v)
    except (ValueError, TypeError):
        return default


def _to_float(v, default=0.0):
    """Coerce a value to float."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    try:
        return float(v)
    except (ValueError, TypeError):
        return default


def _to_bool(v, default=False):
    """Coerce a value to bool."""
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ('true', '1', 'yes')
    return default


# ---- insurance_knowledge_base ----

def execute_insurance_knowledge_base(query_type: str, search_term: str | None = None, **_) -> str:
    try:
        if query_type == "products":
            sql = (
                "SELECT p.id, p.name, p.code, p.base_premium, "
                "c.name AS category_name, sc.name AS subcategory_name "
                "FROM products p "
                "LEFT JOIN insurance_categories c ON p.category_id = c.id "
                "LEFT JOIN insurance_subcategories sc ON p.subcategory_id = sc.id"
            )
            params: tuple = ()
            if search_term:
                sql += " WHERE (p.name LIKE %s OR p.code LIKE %s)"
                like = f"%{search_term}%"
                params = (like, like)
            sql += " ORDER BY p.name LIMIT 25"
            rows = _db_query(sql, params)
            return json.dumps(rows, default=str) if rows else "No products found."

        elif query_type == "rules":
            sql = "SELECT id, name, rule_json, version, effective_from, effective_to FROM eligibility_rules"
            params = ()
            if search_term:
                sql += " WHERE (name LIKE %s OR rule_json LIKE %s)"
                like = f"%{search_term}%"
                params = (like, like)
            sql += " ORDER BY name LIMIT 25"
            rows = _db_query(sql, params)
            return json.dumps(rows, default=str) if rows else "No rules found."

        elif query_type == "pricing":
            sql = "SELECT id, name, pricing_json, version, effective_from, effective_to FROM pricing_tables ORDER BY name LIMIT 25"
            rows = _db_query(sql)
            return json.dumps(rows, default=str) if rows else "No pricing tables found."

        elif query_type == "categories":
            sql = "SELECT id, name, code, description, active FROM insurance_categories WHERE active = 1 ORDER BY display_order, name LIMIT 25"
            rows = _db_query(sql)
            return json.dumps(rows, default=str) if rows else "No categories found."

        return f"Unknown query_type: {query_type}"
    except Exception as e:
        logger.error("insurance_knowledge_base error: %s", e, exc_info=True)
        return f"Error querying knowledge base: {e}"


# ---- database_query ----

def execute_database_query(query_type: str, product_id: int | None = None, search_term: str | None = None, **_) -> str:
    try:
        if query_type == "list_products":
            rows = _db_query(
                "SELECT p.id, p.name, p.code, p.base_premium, "
                "c.name AS category_name, sc.name AS subcategory_name "
                "FROM products p "
                "LEFT JOIN insurance_categories c ON p.category_id = c.id "
                "LEFT JOIN insurance_subcategories sc ON p.subcategory_id = sc.id "
                "ORDER BY p.name LIMIT 50"
            )
        elif query_type == "product_details" and product_id:
            rows = _db_query(
                "SELECT p.*, c.name AS category_name, sc.name AS subcategory_name "
                "FROM products p "
                "LEFT JOIN insurance_categories c ON p.category_id = c.id "
                "LEFT JOIN insurance_subcategories sc ON p.subcategory_id = sc.id "
                "WHERE p.id = %s LIMIT 1",
                (product_id,),
            )
        elif query_type == "list_rules":
            rows = _db_query("SELECT id, name, rule_json, version, effective_from, effective_to FROM eligibility_rules ORDER BY name LIMIT 50")
        elif query_type == "search_products" and search_term:
            like = f"%{search_term}%"
            rows = _db_query(
                "SELECT p.id, p.name, p.code, p.base_premium, "
                "c.name AS category_name "
                "FROM products p "
                "LEFT JOIN insurance_categories c ON p.category_id = c.id "
                "WHERE (p.name LIKE %s OR p.code LIKE %s) LIMIT 25",
                (like, like),
            )
        elif query_type == "list_categories":
            rows = _db_query("SELECT id, name, code, description FROM insurance_categories WHERE active = 1 ORDER BY display_order, name LIMIT 50")
        elif query_type == "list_pricing_tables":
            rows = _db_query("SELECT id, name, pricing_json, version FROM pricing_tables ORDER BY name LIMIT 50")
        else:
            return f"Invalid query_type or missing parameters: {query_type}"
        return json.dumps(rows, default=str) if rows else "No results found."
    except Exception as e:
        logger.error("database_query error: %s", e, exc_info=True)
        return f"Error querying database: {e}"


# ---- web_search ----

def execute_web_search(query: str, max_results: int = 5, **_) -> str:
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=min(max_results, 10)))
        if not results:
            return "No search results found."
        formatted = []
        for r in results:
            formatted.append(f"**{r.get('title', '')}**\n{r.get('body', '')}\nURL: {r.get('href', '')}")
        return "\n\n---\n\n".join(formatted)
    except Exception as e:
        logger.error("web_search error: %s", e, exc_info=True)
        return f"Web search failed: {e}"


# ---- calculator ----

_CALC_FUNCTIONS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "pow": pow,
    "log": math.log,
    "log10": math.log10,
    "ceil": math.ceil,
    "floor": math.floor,
    "pi": math.pi,
    "e": math.e,
}


def execute_calculator(expression: str, **_) -> str:
    try:
        result = simple_eval(expression, functions=_CALC_FUNCTIONS, names={"pi": math.pi, "e": math.e})
        return str(result)
    except Exception as e:
        logger.warning("calculator eval failed for %r: %s", expression, e)
        return f"Could not evaluate expression: {e}"


# ---- policy_scoring ----

async def execute_policy_scoring(
    age="0",
    monthly_income="0",
    monthly_expenses="0",
    is_smoker="false",
    occupation="",
    education_level="",
    dependents="0",
    # Extended wizard fields
    needs_text="",
    is_pep="false",
    has_criminal_history="false",
    occupation_hazard_level="1",
    net_worth="0",
    liquid_net_worth="0",
    target_premium_range="",
    premium_payment_years="AllYears",
    preferred_payment_mode="Monthly",
    loans_text="",
    children_ages="",
    protection_purpose="SurvivorIncome",
    desired_policy_term_years="20",
    desired_sum_assured="0",
    priority_safety="3",
    priority_flexibility="3",
    priority_equity="3",
    priority_certainty="3",
    priority_premium_level="3",
    health="good",
    conditions="",
    heart_disease="false",
    cancer="false",
    stroke="false",
    other_organ_issues="false",
    hospitalization_5yrs="false",
    family_history="false",
    hazardous_pursuits="false",
    flying_activity="false",
    **_,
) -> str:
    """Call the internal /score endpoint to rank products for a profile."""
    # Coerce types — LLMs send all args as strings via Groq
    age = _to_int(age)
    monthly_income = _to_float(monthly_income)
    monthly_expenses = _to_float(monthly_expenses)
    is_smoker = _to_bool(is_smoker)
    dependents = _to_int(dependents)
    is_pep = _to_bool(is_pep)
    has_criminal_history = _to_bool(has_criminal_history)
    occupation_hazard_level = _to_int(occupation_hazard_level, 1)
    net_worth = _to_float(net_worth)
    liquid_net_worth = _to_float(liquid_net_worth)
    desired_policy_term_years = _to_int(desired_policy_term_years, 20)
    desired_sum_assured = _to_float(desired_sum_assured)
    priority_safety = _to_int(priority_safety, 3)
    priority_flexibility = _to_int(priority_flexibility, 3)
    priority_equity = _to_int(priority_equity, 3)
    priority_certainty = _to_int(priority_certainty, 3)
    priority_premium_level = _to_int(priority_premium_level, 3)
    heart_disease = _to_bool(heart_disease)
    cancer = _to_bool(cancer)
    stroke = _to_bool(stroke)
    other_organ_issues = _to_bool(other_organ_issues)
    hospitalization_5yrs = _to_bool(hospitalization_5yrs)
    family_history = _to_bool(family_history)
    hazardous_pursuits = _to_bool(hazardous_pursuits)
    flying_activity = _to_bool(flying_activity)
    # Parse conditions: could be comma-separated string or list
    if isinstance(conditions, str):
        conditions_list = [c.strip() for c in conditions.split(",") if c.strip()] if conditions else []
    elif isinstance(conditions, list):
        conditions_list = conditions
    else:
        conditions_list = []

    try:
        # Fetch active products with full metadata from DB
        products_rows = _db_query(
            "SELECT p.id, p.name, p.code, p.base_premium, p.tags_json, "
            "p.benefits_json, p.riders_json, p.eligibility_json, "
            "p.min_eligible_age, p.max_eligible_age, "
            "p.min_policy_term_years, p.max_policy_term_years, "
            "c.code AS category_code, c.name AS category_name, "
            "sc.code AS subcategory_code, sc.name AS subcategory_name "
            "FROM products p "
            "LEFT JOIN insurance_categories c ON p.category_id = c.id "
            "LEFT JOIN insurance_subcategories sc ON p.subcategory_id = sc.id "
            "ORDER BY p.name LIMIT 50"
        )
        if not products_rows:
            return "No active products found in the database to score against."

        products = []
        for row in products_rows:
            products.append({
                "code": row.get("code", ""),
                "name": row.get("name", ""),
                "basePremium": float(row.get("base_premium", 0) or 0),
                "tags": _safe_json_parse(row.get("tags_json"), []),
                "category": row.get("category_name", ""),
                "categoryCode": row.get("category_code", ""),
                "subCategory": row.get("subcategory_name", ""),
                "subCategoryCode": row.get("subcategory_code", ""),
                "benefits": _safe_json_parse(row.get("benefits_json"), []),
                "riders": _safe_json_parse(row.get("riders_json"), []),
                "eligibility": _safe_json_parse(row.get("eligibility_json"), {}),
                "minEligibleAge": int(row.get("min_eligible_age", 0) or 0),
                "maxEligibleAge": int(row.get("max_eligible_age", 99) or 99),
                "minPolicyTermYears": int(row.get("min_policy_term_years", 0) or 0),
                "maxPolicyTermYears": int(row.get("max_policy_term_years", 0) or 0),
            })

        # Build features matching the full ScoreRequest schema
        features = {
            "age": age,
            "monthlyIncomeLkr": monthly_income,
            "monthlyExpensesLkr": monthly_expenses,
            "smoker": is_smoker,
            "isPep": is_pep,
            "hasCriminalHistory": has_criminal_history,
            "educationLevel": education_level or "Undergrad",
            "occupation": occupation,
            "occupationHazardLevel": occupation_hazard_level,
            "netWorthLkr": net_worth,
            "conditions": conditions_list,
            "heartDisease": heart_disease,
            "cancer": cancer,
            "stroke": stroke,
            "otherOrganIssues": other_organ_issues,
            "hospitalization5Yrs": hospitalization_5yrs,
            "familyHistory": family_history,
            "hazardousPursuits": hazardous_pursuits,
            "flyingActivity": flying_activity,
            "protectionPurpose": protection_purpose,
            "desiredPolicyTermYears": desired_policy_term_years,
            "desiredSumAssured": desired_sum_assured,
            "prioritySafety": priority_safety,
            "priorityFlexibility": priority_flexibility,
            "priorityEquity": priority_equity,
            "priorityCertainty": priority_certainty,
            "priorityPremiumLevel": priority_premium_level,
            "memberCount": dependents,
            "childrenAges": children_ages,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                chat_config.AI_ENGINE_SCORE_URL,
                json={"sessionId": "open-chat", "features": features, "products": products},
            )
            resp.raise_for_status()
            data = resp.json()

        ranked = data.get("rankedProducts", [])
        follow_ups = data.get("followUpQuestions", [])
        if not ranked:
            return "Scoring returned no results."

        # Build rich formatted output for the LLM to present
        lines = ["## Insurance Recommendations\n"]
        for i, p in enumerate(ranked[:5], 1):
            score_pct = round((p.get("score", 0)) * 100)
            premium = round(p.get("monthlyPremiumEstimate", 0))
            affordability = round((p.get("affordabilityScore", 0)) * 100)
            coverage = round(p.get("predictedCoverage", 0))
            eligibility = p.get("eligibilityDecision", "Unknown")
            reasons = p.get("reasons", [])
            rider_excl = p.get("riderExclusions", [])
            category = p.get("category", "")
            sub_cat = p.get("subCategory", "")

            lines.append(f"### {i}. {p.get('name')} ({p.get('code')})")
            lines.append(f"- **Category**: {category} > {sub_cat}")
            lines.append(f"- **Suitability Score**: {score_pct}%")
            lines.append(f"- **Monthly Premium**: ~{premium:,} LKR")
            lines.append(f"- **Predicted Coverage**: {coverage:,} LKR")
            lines.append(f"- **Affordability**: {affordability}%")
            lines.append(f"- **Eligibility**: {eligibility}")

            if rider_excl:
                lines.append(f"- **Excluded Riders**: {', '.join(rider_excl)}")

            prem_exp = p.get("premiumExplanation", {})
            if prem_exp:
                risk_mult = prem_exp.get("riskMultiplier", 1.0)
                rider_cost = round(prem_exp.get("selectedRiderPremium", 0))
                lines.append(f"- **Risk Multiplier**: {risk_mult}x")
                if rider_cost > 0:
                    lines.append(f"- **Rider Cost**: {rider_cost:,} LKR/month")

            if reasons:
                lines.append("- **Why this plan**: " + "; ".join(reasons[:4]))
            lines.append("")

        if follow_ups:
            lines.append("---")
            lines.append("### Follow-up Questions for Better Accuracy")
            lines.append("The scoring engine suggests asking these to refine results:\n")
            for fq in follow_ups:
                lines.append(f"- **{fq.get('question', '')}** (field: {fq.get('key', '')}) — {fq.get('reason', '')}")

        return "\n".join(lines)

    except Exception as e:
        logger.error("policy_scoring error: %s", e, exc_info=True)
        return f"Policy scoring failed: {e}"


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

TOOL_EXECUTORS: dict[str, Any] = {
    "insurance_knowledge_base": execute_insurance_knowledge_base,
    "database_query": execute_database_query,
    "web_search": execute_web_search,
    "calculator": execute_calculator,
    "policy_scoring": execute_policy_scoring,
}


async def execute_tool(name: str, arguments: dict[str, Any]) -> str:
    """Execute a tool by name with the given arguments, return result string."""
    executor = TOOL_EXECUTORS.get(name)
    if executor is None:
        return f"Unknown tool: {name}"

    import asyncio
    if asyncio.iscoroutinefunction(executor):
        return await executor(**arguments)
    else:
        return executor(**arguments)
