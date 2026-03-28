# Insurance University

Full-stack insurance recommendation platform with an Angular frontend, Spring Boot backend, MySQL database, and a Python FastAPI AI engine microservice.

---

## Architecture

```
Angular (port 4200)  →  Spring Boot (port 8080)  →  Python AI Engine (port 8000)
                                ↓
                           MySQL (port 3306)
```

---

## Quick Start — Docker (MySQL + AI Engine)

```bash
# Start MySQL and the AI Engine in the background
docker compose up -d

# Verify services are healthy
docker compose ps
```

- **MySQL** is available at `localhost:3306`
- **AI Engine** health check: `curl http://localhost:8000/health`

---

## Running the Backend (Spring Boot)

Requires Java 17+ and Maven 3.8+.

```bash
cd backend
mvn spring-boot:run
```

The backend starts on **port 8080** and connects to:
- MySQL at `localhost:3306` (database `insurance_university`)
- AI Engine at `http://localhost:8000` (configurable via `AI_ENGINE_URL`)

Default admin credentials: `admin@local` / `Admin@123`

To point the backend at the docker-networked AI engine instead:

```bash
AI_ENGINE_URL=http://ai-engine:8000 mvn spring-boot:run
```

---

## Running the AI Engine (FastAPI)

Requires Python 3.11+.

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The AI engine starts on **port 8000**.  
Health check: `curl http://localhost:8000/health`

---

## Running the Frontend (Angular)

Requires Node.js 18+ and npm.

```bash
cd frontend
npm install
npm start       # equivalent to: ng serve
```

Open **http://localhost:4200** in your browser.

### Frontend environment configuration

API base URLs are defined in `src/environments/`:

| File | Used when |
|---|---|
| `environment.development.ts` | `ng serve` (default) |
| `environment.ts` | production build (`ng build --configuration production`) |

Both files default to `http://localhost:8080/api` for Spring Boot and `http://localhost:8000` for the AI engine.

### Customer journey routes

| URL | Description |
|---|---|
| `/` | Landing page |
| `/login` | Customer login |
| `/register` | Customer registration |
| `/wizard/step-1` | Intake wizard — needs text |
| `/wizard/step-2` | Intake wizard — financial profile |
| `/wizard/step-3` | Intake wizard — health & lifestyle |
| `/recommendations` | AI-ranked product recommendations |
| `/recommendations/compare` | Plan comparison |
| `/proposal/upload` | Document upload |
| `/proposal/missing` | Missing information form |
| `/proposal/summary` | Proposal preview & PDF download |
| `/simulator` | Premium what-if simulator |
| `/survey` | Post-session feedback survey |

### Admin journey routes

| URL | Description |
|---|---|
| `/admin/login` | Admin login (credentials: `admin@local` / `Admin@123`) |
| `/admin/dashboard` | Overview with navigation links |
| `/admin/rules` | Eligibility rules & pricing tables |
| `/admin/training` | Dataset upload & model version management |
| `/admin/logs` | Session log search, filter & export |
| `/admin/insights` | Unmatched needs insights |

---

## Example API Calls (Customer Journey)

### 1. Create a session

```bash
curl -X POST http://localhost:8080/api/customer/sessions
# → { "sessionId": "550e8400-e29b-41d4-a716-446655440000" }
```

### 2. Submit wizard answers

```bash
SESSION_ID="<sessionId from step 1>"

curl -X POST http://localhost:8080/api/customer/sessions/$SESSION_ID/answers \
  -H "Content-Type: application/json" \
  -d '{
    "age": 35,
    "income": 75000,
    "smoker": false,
    "dependents": 2,
    "coverageAmount": 5000000,
    "health": "good",
    "conditions": []
  }'
# → { "status": "ok" }
```

### 3. Get AI recommendations

```bash
curl -X POST http://localhost:8080/api/customer/sessions/$SESSION_ID/recommendations
# → {
#     "sessionId": "...",
#     "rankedProducts": [
#       {
#         "code": "FAMILY-SHIELD",
#         "name": "Family Shield Plan",
#         "score": 0.75,
#         "monthlyPremiumEstimate": 4500.0,
#         "reasons": ["Non-smoker discount applied", "2 dependent(s) — family coverage recommended", ...]
#       },
#       ...
#     ]
#   }
```

### 4. Get session details

```bash
curl http://localhost:8080/api/customer/sessions/$SESSION_ID
```

---

## Admin API

Admin endpoints are protected by JWT. Log in first:

```bash
curl -X POST http://localhost:8080/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"Admin@123"}'
# → { "accessToken": "..." }
```

Then pass the token as `Authorization: Bearer <token>` for all `/api/admin/**` requests.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AI_ENGINE_URL` | `http://localhost:8000` | URL of the Python AI engine |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/insurance_university` | MySQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `root` | MySQL user |
| `SPRING_DATASOURCE_PASSWORD` | `root` | MySQL password |

---

## MCP Setup (Workspace)

This repository includes a versioned VS Code workspace file with recommended MCP servers:

- `git` for repository-aware context and history
- `mysql` for local database schema/data exploration
- `fetch` for API/health endpoint inspection

Workspace file:

- `insurance-university.code-workspace`

### Open with MCP enabled

1. In VS Code, open the workspace file instead of only the folder.
2. Confirm MCP servers appear in the MCP Servers view.
3. If prompted, allow `npx` to install MCP server packages.

### MCP smoke checks

Use Copilot Chat prompts such as:

- "Using mysql MCP, list all tables in insurance_university"
- "Using fetch MCP, get http://localhost:8000/health"
- "Using fetch MCP, get http://localhost:8080/api/auth/me"
- "Using git MCP, show current branch and changed files"

Expected note: `/api/auth/me` should return unauthorized without a token; this still confirms the backend is reachable.

### Hardening follow-up (recommended)

The workspace defaults use local dev credentials (`root` / `root`) for quick startup. For safer non-dev usage:

1. Create a least-privilege read-only MySQL user for MCP queries.
2. Replace root credentials in workspace settings with that user.
3. Restrict fetch MCP use to local/internal endpoints only.
4. Rotate passwords regularly and avoid committing secrets for shared environments.

Example MySQL user creation:

```sql
CREATE USER 'mcp_reader'@'localhost' IDENTIFIED BY 'change_me_now';
GRANT SELECT, SHOW VIEW ON insurance_university.* TO 'mcp_reader'@'localhost';
FLUSH PRIVILEGES;
```

