# GitHub Copilot Workspace Instructions

Insurance University is a multi-service insurance recommendation platform.
This file is optimized for Copilot context efficiency: practical, concise, and link-first.

Principles
- Link to source files instead of duplicating large code or trees.
- Keep commands copyable and directory-specific.
- Preserve high-detail operational sections: Service Details and API Reference.

## 1) Project Overview

Insurance University provides:
- A customer journey: onboarding, wizard, recommendations, comparison, simulator, proposal flow.
- An admin journey: product/rule management, training datasets/models, logs, insights.

Primary docs and entry points
- Project overview: [README.md](../README.md)
- Compose setup: [docker-compose.yml](../docker-compose.yml)
- Backend source root: [backend/src/main/java](../backend/src/main/java)
- Frontend source root: [frontend/src/app](../frontend/src/app)
- AI engine source: [ai-engine/app/main.py](../ai-engine/app/main.py)

## 2) Technology Stack

- Frontend: Angular 21, Angular Material, Tailwind CSS
- Backend: Spring Boot 3.3.5, Java 17, Maven
- Security: Spring Security + JWT (JJWT)
- Database: MySQL 8.4
- AI Engine: FastAPI, Uvicorn, Pydantic
- Orchestration: Docker Compose

Dependency manifests
- Frontend: [frontend/package.json](../frontend/package.json)
- Backend: [backend/pom.xml](../backend/pom.xml)
- AI Engine: [ai-engine/requirements.txt](../ai-engine/requirements.txt)

## 3) Architecture

```text
Angular SPA (4200)
  -> Spring Boot API (8080) + MySQL (3306)
      -> FastAPI AI engine (8000)
```

Flow and auth notes
- Frontend calls backend with Bearer JWT on authenticated routes.
- Backend calls AI engine for scoring/training.
- Backend CORS allows frontend localhost origin in security config.

Reference files
- Security and CORS: [backend/src/main/java/com/insuranceuniversity/backend/config/SecurityConfig.java](../backend/src/main/java/com/insuranceuniversity/backend/config/SecurityConfig.java)
- Backend AI client: [backend/src/main/java/com/insuranceuniversity/backend/service/AiEngineClient.java](../backend/src/main/java/com/insuranceuniversity/backend/service/AiEngineClient.java)
- Frontend interceptors: [frontend/src/app/core/interceptors](../frontend/src/app/core/interceptors)

## 4) Project Structure (Lite)

Use this as a fast locator. For deeper structure, use file explorer and source roots.

```text
insurance-university/
  docker-compose.yml
  README.md
  ai-engine/
    app/main.py
    requirements.txt
  backend/
    pom.xml
    src/main/java/com/insuranceuniversity/backend/
      auth/ config/ controller/ entity/ filter/ repository/ service/
    src/main/resources/application.yml
  frontend/
    package.json
    src/app/
      core/ features/ app.routes.ts
```

## 5) Service Details (Detailed)

### 5.1 Frontend (Angular)

Routing and guards
- Route definition: [frontend/src/app/app.routes.ts](../frontend/src/app/app.routes.ts)
- All major feature routes are lazy-loaded with `import(...)`.
- Guarded flows enforce access and step order:
  - Customer auth guard for protected customer pages.
  - Admin guard for admin console pages.
  - Wizard progress guard for step-2 and step-3 sequencing.

Core frontend files
- Customer API service: [frontend/src/app/core/customer-api.service.ts](../frontend/src/app/core/customer-api.service.ts)
- Admin API service: [frontend/src/app/features/admin/admin-api.service.ts](../frontend/src/app/features/admin/admin-api.service.ts)
- Wizard state service: [frontend/src/app/core/state/wizard-state.service.ts](../frontend/src/app/core/state/wizard-state.service.ts)
- Customer auth service: [frontend/src/app/core/services/customer-auth.service.ts](../frontend/src/app/core/services/customer-auth.service.ts)
- Interceptors: [frontend/src/app/core/interceptors](../frontend/src/app/core/interceptors)
- Guards: [frontend/src/app/core/guards](../frontend/src/app/core/guards)

Feature areas
- Admin: dashboard, insights, logs, products, rules, training, login, layout.
- Auth: customer login/register.
- Customer: dashboard.
- Wizard: step-1, step-2, step-3.
- Recommendations: list and compare.
- Proposal: upload, missing, summary.
- Simulator, survey, landing, home.

Route groups (high-level)
- Public: `/`, `/login`, `/register`, `/survey`.
- Wizard: `/wizard/step-1`, `/wizard/step-2`, `/wizard/step-3`.
- Customer protected: `/recommendations`, `/recommendations/compare`, `/simulator`, `/customer/dashboard`, `/proposal/upload`, `/proposal/missing`, `/proposal/summary`.
- Admin: `/admin/login`, `/admin/dashboard`, `/admin/products`, `/admin/rules`, `/admin/training`, `/admin/logs`, `/admin/insights`.

### 5.2 Backend (Spring Boot)

Package root
- `com.insuranceuniversity.backend`
- Source root: [backend/src/main/java/com/insuranceuniversity/backend](../backend/src/main/java/com/insuranceuniversity/backend)

Backend layer map
- `auth`: JWT generation/validation and auth filter.
- `config`: Spring Security, CORS, authorization rules.
- `controller`: REST endpoints.
- `entity`: JPA entities.
- `repository`: Spring Data repositories.
- `service`: business logic + AI integration.
- `filter`: request/response logging and redaction.

Controllers and responsibilities
- `AuthController`: registration/login/profile identity endpoints.
- `CustomerController`: sessions, answers, recommendations, feedback.
- `ProductAdminController`: product CRUD.
- `RuleController`: rule CRUD.
- `LogAdminController`: searchable logs and export.
- `TrainingController`: dataset upload and model lifecycle.
- `InsightsController`: unmatched-needs management.
- `PricingTableController`: pricing table CRUD.
- `ClientLogController`: client-side event ingestion.
- `DevSeedController`: dev seed data endpoint.

Critical backend references
- Controllers: [backend/src/main/java/com/insuranceuniversity/backend/controller](../backend/src/main/java/com/insuranceuniversity/backend/controller)
- Entities: [backend/src/main/java/com/insuranceuniversity/backend/entity](../backend/src/main/java/com/insuranceuniversity/backend/entity)
- Services: [backend/src/main/java/com/insuranceuniversity/backend/service](../backend/src/main/java/com/insuranceuniversity/backend/service)
- Repositories: [backend/src/main/java/com/insuranceuniversity/backend/repository](../backend/src/main/java/com/insuranceuniversity/backend/repository)
- Logging filter: [backend/src/main/java/com/insuranceuniversity/backend/filter/RequestResponseLoggingFilter.java](../backend/src/main/java/com/insuranceuniversity/backend/filter/RequestResponseLoggingFilter.java)

Security model
- Stateless JWT auth.
- Roles: CUSTOMER and ADMIN.
- Sensitive fields are redacted in log filter.

### 5.3 AI Engine (FastAPI)

Source
- [ai-engine/app/main.py](../ai-engine/app/main.py)

Responsibilities
- Health endpoint for service readiness.
- Score endpoint for recommendation ranking pipeline.
- Train endpoint for updating in-memory feature weights.

Scoring pipeline summary
- Eligibility/underwriting decision checks.
- Product scoring via profile + product features.
- Coverage and affordability calculations.
- Rider and policy-class considerations.
- Ranked response with reasons and scores.

AI dependencies
- [ai-engine/requirements.txt](../ai-engine/requirements.txt)

### 5.4 Database (MySQL)

- Engine: MySQL 8.4
- Default DB: `insurance_university`
- Persistent volume in compose: `mysql_data`
- JPA schema mode: `ddl-auto: update`

References
- Compose service: [docker-compose.yml](../docker-compose.yml)
- Backend config: [backend/src/main/resources/application.yml](../backend/src/main/resources/application.yml)

## 6) API Reference (Detailed)

### 6.1 Auth

Customer/Auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Admin auth API
- `POST /api/auth/admin/login`

### 6.2 Customer APIs (CUSTOMER role)

Sessions
- `POST /api/customer/sessions`
- `GET /api/customer/sessions`
- `GET /api/customer/sessions/{sessionId}`
- `DELETE /api/customer/sessions/{sessionId}`

Answers and recommendations
- `POST /api/customer/sessions/{sessionId}/answers`
- `POST /api/customer/sessions/{sessionId}/recommendations`

Feedback
- `POST /api/customer/feedback`

Client logging
- `POST /api/logs` (public event logging endpoint)

### 6.3 Admin APIs (ADMIN role)

Products
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/{id}`
- `PUT /api/admin/products/{id}`
- `DELETE /api/admin/products/{id}`

Rules
- `GET /api/admin/rules`
- `POST /api/admin/rules`
- `GET /api/admin/rules/{id}`
- `PUT /api/admin/rules/{id}`
- `DELETE /api/admin/rules/{id}`

Logs
- `GET /api/admin/logs`
- Query filters: `from`, `to`, `eventType`, `sessionHash`, `userSegment`
- `GET /api/admin/logs/export`
- Export format query: `format=csv|jsonl`

Training
- `POST /api/admin/training/datasets` (multipart CSV upload)
- `GET /api/admin/training/datasets`
- `POST /api/admin/training/models`
- `GET /api/admin/training/models`

Insights
- `GET /api/admin/insights/unmatched-needs`
- `POST /api/admin/insights/unmatched-needs`
- `DELETE /api/admin/insights/unmatched-needs/{id}`

Pricing tables
- `GET /api/admin/pricing-tables`
- `POST /api/admin/pricing-tables`
- `GET /api/admin/pricing-tables/{id}`
- `PUT /api/admin/pricing-tables/{id}`
- `DELETE /api/admin/pricing-tables/{id}`

Dev-only
- `POST /api/admin/dev/seed`

### 6.4 AI Engine APIs

- `GET /health`
- `POST /score`
- `POST /train`

API implementation references
- Backend controllers: [backend/src/main/java/com/insuranceuniversity/backend/controller](../backend/src/main/java/com/insuranceuniversity/backend/controller)
- AI endpoints: [ai-engine/app/main.py](../ai-engine/app/main.py)

## 7) Configuration and Environment

Backend config file
- [backend/src/main/resources/application.yml](../backend/src/main/resources/application.yml)

Important keys
- `server.port` (backend port)
- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`
- `spring.jpa.hibernate.ddl-auto`
- `app.uploadsDir`
- `app.aiEngineUrl`
- `app.jwt.secret`
- `app.jwt.expirationMs`
- `admin.email`
- `admin.password`

AI endpoint override example
```bash
AI_ENGINE_URL=http://ai-engine:8000 mvn spring-boot:run
```

Frontend env files
- [frontend/src/environments/environment.ts](../frontend/src/environments/environment.ts)
- [frontend/src/environments/environment.development.ts](../frontend/src/environments/environment.development.ts)

## 8) Quick-Start Commands

### 8.1 Full stack (integration)

From repo root:
```bash
docker-compose up --build
```

This starts MySQL and AI engine. Run backend/frontend separately for local dev.

### 8.2 Backend

```bash
cd backend
mvn spring-boot:run
```

With explicit AI URL:
```bash
cd backend
AI_ENGINE_URL=http://localhost:8000 mvn spring-boot:run
```

Requirements
- Java 17+
- Maven 3.8+
- MySQL reachable on configured host/port

### 8.3 AI Engine

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Requirement
- Python 3.11+

### 8.4 Frontend

```bash
cd frontend
npm install
npm start
npm run build
npm run test
npm run lint
```

Requirement
- Node.js LTS

### 8.5 Health checks

```bash
curl http://localhost:8000/health
curl http://localhost:8080/api/auth/me
```

Expected second result without auth is 401/unauthorized, which still indicates backend is running.

## 9) Key Conventions and Patterns

Backend conventions
- Follow package layering: auth/config/controller/entity/filter/repository/service.
- Keep controllers thin; move business logic to services.
- Use `AiEngineClient` for backend-to-AI integration.
- Avoid logging secrets/tokens; rely on redaction filter behavior.

Frontend conventions
- Keep routes lazy-loaded in route config.
- Use customer/admin interceptors for bearer token injection.
- Keep wizard data in `wizard-state.service.ts`, not ad-hoc component state.
- Use customer/admin API services by domain path.

AI conventions
- Keep scoring deterministic and explainable.
- `/train` updates runtime weights; persistence is not guaranteed across restart.
- Keep response models aligned with backend expectations.

## 10) Default Credentials (Dev Only)

- Admin portal: `admin@local` / `Admin@123`
- MySQL: `root` / `root`
- Database: `insurance_university`

Change defaults before any non-local deployment.

## 11) Testing Status

Current status
- Backend test directory is minimal/absent in active project structure.
- Frontend has limited or no `.spec.ts` coverage currently.
- Manual API checks are documented in README.

Recommended short-term testing focus
- Backend controller-service integration for auth, sessions, recommendations.
- Frontend guard and route behavior around wizard/admin/customer flows.
- AI `/score` request/response contract checks.

## 12) Useful Copilot Tasks

Use these prompts directly in chat when needed:
- List controller endpoints and role requirements.
- Trace request flow from frontend route to backend controller to AI call.
- Add a new admin endpoint with controller/service/repository updates.
- Add a new wizard field end-to-end (UI, state, API payload, backend persistence).
- Generate curl examples for a full recommendation run.

For per-area overlays
- Request applyTo-specific instruction files for `backend/**`, `frontend/**`, and `ai-engine/**` to keep context even lighter.

## 13) MCP Workspace Setup

Workspace MCP configuration is versioned in:
- [insurance-university.code-workspace](../insurance-university.code-workspace)

Included MCP servers
- `git`: repository context and history
- `mysql`: local `insurance_university` database exploration
- `fetch`: local backend/AI endpoint checks

Quick notes
- Open the workspace file (not only folder-open mode) to load MCP settings.
- Current mysql defaults are local-dev credentials and should be hardened for non-dev usage.
