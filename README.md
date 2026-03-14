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

```bash
cd backend
mvn spring-boot:run
```

By default the backend connects to:
- MySQL at `localhost:3306`
- AI Engine at `http://localhost:8000` (env var `AI_ENGINE_URL`)

To point the backend at the docker-networked AI engine instead:

```bash
AI_ENGINE_URL=http://ai-engine:8000 mvn spring-boot:run
```

Or if both MySQL and AI engine run via docker compose (and the backend joins the same network), set `AI_ENGINE_URL=http://ai-engine:8000` in your shell / `.env` file.

---

## Running the AI Engine Locally (without Docker)

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Running the Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:4200` in your browser.

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
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"Admin@123"}'
# → { "token": "..." }
```

Then pass the token as `Authorization: Bearer <token>` for `/api/admin/**` requests.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AI_ENGINE_URL` | `http://localhost:8000` | URL of the Python AI engine |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/insurance_university` | MySQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `root` | MySQL user |
| `SPRING_DATASOURCE_PASSWORD` | `root` | MySQL password |

