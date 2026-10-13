# build-progress.md — GreenShift Implementation Progress

*Single persistent source of verified project state. Maintained exclusively by the AI build agent per `build-rule.md`.*

Last Updated: 2026-10-14  
Current Status: Ready for Phase 0 Execution (Documentation Audit & Spec Lock Completed)  
Active Branch: `main`  
Latest Verified Phase Tag: None (Pre-implementation)

---

## 1. Phase Status Summary

| Phase | Title | Status | Verified Git Tag | Notes / Blocker |
|---|---|---|---|---|
| 0 | Repository, tooling, spec lock | `VERIFIED` | `phase-0-verified` | Python 3.12.14, Node 24.21.0, uv 0.12.5 |
| 1 | Core infrastructure | `NOT_STARTED` | — | Config, Clock, logging, errors |
| 2 | Database and state machine | `NOT_STARTED` | — | SQLAlchemy 2, SQLite WAL, Alembic |
| 3 | Authentication and rate limiting | `NOT_STARTED` | — | JWT, API keys, Argon2, slowapi |
| 4 | Carbon data layer | `NOT_STARTED` | — | NESO client, Mock curve, cache |
| 5 | Optimization core | `NOT_STARTED` | — | Pure HiGHS MILP, greedy, ASAP |
| 6 | Planner, decisions, explanations | `NOT_STARTED` | — | Plans, reason codes, estimates |
| 7 | Job intake and preview API | `NOT_STARTED` | — | `POST /jobs`, SSRF checks, preview |
| 8 | Dispatcher and executors | `NOT_STARTED` | — | CAS tick, simulated & forward exec |
| 9 | Background loops, controls, settings | `NOT_STARTED` | — | APScheduler, operator controls |
| 10 | Analytics and export | `NOT_STARTED` | — | Aggregate emissions, CSV export |
| 11 | Demo mode backend | `NOT_STARTED` | — | Simulated clock, scenarios, echo |
| 12 | Frontend foundation | `NOT_STARTED` | — | Shell, tokens, typed client, states |
| 13 | Dashboard and carbon timeline | `NOT_STARTED` | — | 48h SVG timeline, lane packing |
| 14 | Jobs views and submission | `NOT_STARTED` | — | Jobs table, detail, preview form |
| 15 | Analytics, settings, system UIs | `NOT_STARTED` | — | Recharts views, admin settings |
| 16 | Hardening, performance, E2E | `NOT_STARTED` | — | Playwright E2E, benchmarks |
| 17 | Packaging, docs, final audit | `NOT_STARTED` | — | Docker compose, audit, v1.0.0 |

---

## 2. Current Phase Details

### Phase 0 — Repository, tooling and spec lock
- **Status:** `VERIFIED`
- **Prerequisites:** Python 3.12, Node 20, Git. All 5 governing documents present and verified.

### Current Phase Tasks
| Task ID | Task Description | Status | Evidence / Commit |
|---|---|---|---|
| P0.T1 | Verify governing files exist (`docs/PRD.md`, `prd-addendum.md`, `build-rule.md`, `implementation-plan.md`, `build-progress.md`, `AGENTS.md`) and validate PRD v1.1 completeness. | `VERIFIED` | PRD v1.1 ratified across all 20 sections; all governing docs validated. |
| P0.T2 | Setup `.gitignore` (venv, node_modules, `*.db`, `.env`). | `VERIFIED` | `.gitignore` committed; `.env` and `*.db` verified ignored. |
| P0.T3 | Backend: `pyproject.toml` with dependencies; package skeleton; `GET /healthz` stub. | `VERIFIED` | FastAPI app with `/healthz` returning `{"status":"ok"}`; test passes. |
| P0.T4 | Configure ruff, mypy, pytest with coverage. | `VERIFIED` | ruff check/format clean; mypy strict overrides clean; pytest with coverage 100%. |
| P0.T5 | Frontend: Vite + React 18 + TS, Tailwind CSS, React Router, TanStack Query, Vitest, ESLint. | `VERIFIED` | Scaffolding complete; Vitest smoke test passed; ESLint clean; Vite build succeeded. |
| P0.T6 | Makefile targets (`install`, `check`, `backend-dev`, `frontend-dev`, etc.). | `VERIFIED` | Root `Makefile` and `make.bat` wrapper wired; `make check` passes clean. |
| P0.T7 | `.env.example` listing all ADD §8 / PRD §17 variables with safe defaults. | `VERIFIED` | `.env.example` verified with safe defaults and all config keys. |
| P0.T8 | CI workflow (`.github/workflows/ci.yml`) running `make check`. | `VERIFIED` | GitHub Actions workflow created running on ubuntu-latest with `make check`. |

---

## 3. Verified Milestones & Test Status

- **Toolchain Versions (AC-0.5):**
  - Python: `3.12.14`
  - Node: `v24.21.0`
  - npm: `11.19.0`
  - uv: `0.12.5`
  - Git: `2.56.0.windows.2`
- **Latest `make check` status:** PASS (All backend and frontend checks passed cleanly).
- **Backend Test Coverage:** 100% (7/7 statements covered in `app/`).
- **Frontend Tests:** 1 passed (100% test pass rate in Vitest).

---

## 4. Open Issues and Blockers

| Issue ID | Description | Severity | Status | Resolution / Action |
|---|---|---|---|---|
| I-1 | PRD sections 10–20 initially missing in draft file. | High | `RESOLVED` | Completed and codified in `docs/PRD.md` v1.1 and root PRD. Harmonized with `prd-addendum.md`. |
| I-2 | Demo clock speed contradiction between PRD §1 and §6 F11. | Medium | `RESOLVED` | Resolved via ADR-001: Default 120x, 288x preset in UI. |
| I-3 | Discrepancy between PRD location (`docs/PRD.md` vs root file). | Low | `RESOLVED` | Resolved: `docs/PRD.md` is primary authoritative copy; mirrored to root file for parity. |

---

## 5. Architectural Decision Records (ADRs)

| ADR ID | Decision Summary | Rationale & Impact |
|---|---|---|
| **ADR-001** | Default `SIM_SPEED=120`, UI preset 288x for "day in 5 min". | Resolves F11 vs §1 ambiguity. 120x gives smooth, observable pacing; 288x satisfies hackathon rapid demo. |
| **ADR-002** | Delay penalty formula: $\lambda_{\text{prio}} \times \text{delay\_hours} \times \text{energy\_kwh}$. | Guarantees dimensional consistency in the objective function (gCO2e). |
| **ADR-003** | Non-deferrable workloads pre-allocated at earliest feasible slot. | Guarantees immediate execution without violating hard cluster capacity limits. |
| **ADR-004** | Leading-edge debounce with coalescing for plan requests. | Provides immediate response (< 3s) for standalone submissions while coalescing bursts. |
| **ADR-005** | Job submitter tracking via `created_by_user_id`. | Enforces secure ownership: Viewers cancel only their own jobs; Admins manage all jobs. |
| **ADR-006** | Forward executor startup recovery via `failed (INTERRUPTED) -> retry_wait`. | Ensures crash resilience without silent drops or double dispatches. |
| **ADR-007** | `DEMO_MODE=true` defaults to `mock` provider, runtime toggle to `neso`. | Enables offline zero-dependency demos while allowing live grid demonstrations. |
| **ADR-008** | 48-hour rolling optimization horizon ($S=96$ slots). | Bounds MILP complexity to $O(N \cdot 96)$ while dynamically accommodating longer deadlines. |
| **ADR-009** | Adopt `pydantic-settings` and `cryptography` (Fernet). | Required for Pydantic v2 typed configuration and encrypted storage of forward headers. |
| **ADR-010** | `/readyz` 503 only on DB/scheduler failure; degraded provider returns 200 degraded. | Satisfies NFR-03: grid API outages never take down the service. |
| **ADR-011** | Counterfactual baseline computed at `earliest_start_at` independently. | Provides standard, honest baseline representing un-proxied workload emissions. |
| **ADR-012** | Deterministic tie-breaking $\epsilon = 10^{-6} \times (\text{rank} \times S + s)$. | Guarantees reproducible, zero-jitter plans for identical inputs (NFR-12). |

---

## 6. Next Action

- **Target Phase:** Phase 1 — Core infrastructure: config, clock, logging, errors
- **Immediate Task:** P1.T1 — `Settings` via pydantic-settings; fail fast on invalid demo/auth settings.
- **Command to Start:** `Start Phase 1`

---

## 7. Phase Log

```
Phase: 0 — Repository, tooling and spec lock   Status: VERIFIED
Requirements implemented: NFR-10, NFR-11, FR-22 (stub)
Files created/modified: backend/, frontend/, Makefile, make.bat, .env.example, .gitignore, .github/workflows/ci.yml
Tests/validation run: make check (backend-lint, backend-test, frontend-lint, frontend-test, frontend-build)
Results: Backend: 1 passed (100% coverage); Frontend: 1 passed; Build: clean (3.00s); Lint: 0 errors
Acceptance criteria: AC-0.1 ✔ make check passes clean; AC-0.2 ✔ /healthz test passes; AC-0.3 ✔ frontend build succeeds; AC-0.4 ✔ no secret/.db tracked; AC-0.5 ✔ toolchain versions recorded
Known failures / unresolved issues: None
Decisions future phases must keep: None
Current project status: Phase 0 verified and tagged. Clean monorepo foundation with wired quality gates.
Next phase: Phase 1 — Core infrastructure: config, clock, logging, errors
Resume instructions: Start Phase 1
```
