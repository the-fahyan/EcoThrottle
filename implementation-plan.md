# implementation-plan.md — GreenShift Phased Roadmap

*What to build, and in what order. How to work is in `build-rule.md`; what is actually done is in `build-progress.md`. Derived contracts for the PRD's missing §10–20 are in `prd-addendum.md` (cited as **ADD §n**).*

**Reading this file:** do not load all of it. Read this header, then only your phase: `sed -n '/^## Phase 5 /,/^## Phase 6 /p' implementation-plan.md`.

## Common to every phase

- **Global Definition of Done (GDoD):** all phase acceptance criteria pass with evidence; `make check` is green (ruff, mypy, pytest, eslint, vitest, build); no regression in earlier phases; new code has tests; no TODO stubs standing in for required behavior; `build-progress.md` updated; handoff report written; git tag `phase-N-verified` created.
- **Gate to the next phase (generic):** this phase is `VERIFIED` in `build-progress.md`, its tag exists, and `make check` passes on HEAD. Each phase lists extra gate conditions only when they differ.
- **PRD refs** name the only PRD parts to read for that phase (`F3` = feature spec F3, `§8.3` = section, `FR`/`NFR` = tables in §7).

## Target repository layout

```
AGENTS.md  build-rule.md  implementation-plan.md  build-progress.md  prd-addendum.md
docs/PRD.md  docs/DEMO_SCRIPT.md  docs/prd-audit.md   Makefile  .env.example  docker-compose.yml
backend/  pyproject.toml  alembic/  tests/{unit,integration,fixtures}
  app/{main.py, api/, core/, services/, scheduling/, carbon/, db/, execution/, demo/}
frontend/ src/{lib,components,layout,routes,features}  e2e/
demo/echo_target.py   .github/workflows/ci.yml
```

## Phase overview

| # | Title | Main output |
|---|---|---|
| 0 | Repository, tooling, spec lock | Runnable skeleton, `make check` |
| 1 | Core infrastructure | Config, Clock, logging, error envelope |
| 2 | Database and state machine | Schema, migrations, repositories, transitions |
| 3 | Authentication and rate limiting | JWT, API keys, roles |
| 4 | Carbon data layer | Providers, normalization, health, carbon API |
| 5 | Optimization core | Pure MILP/greedy/ASAP solvers |
| 6 | Planner, decisions, explanations | Persisted plans, reason codes, estimates |
| 7 | Job intake and preview API | `POST /jobs`, validation, SSRF, preview |
| 8 | Dispatcher and executors | Exactly-once start, simulated and forward execution |
| 9 | Background loops, controls, settings, system | APScheduler, cancel/run-now/retry, settings, readyz |
| 10 | Analytics and export | Aggregates, realized carbon, CSV |
| 11 | Demo mode backend | Simulated clock control, scenarios, echo target |
| 12 | Frontend foundation | Tokens, shell, auth, API client, shared states |
| 13 | Dashboard and carbon timeline | Signature SVG timeline |
| 14 | Jobs views and submission | List, detail, form with live preview |
| 15 | Analytics, settings, system, demo UIs | Remaining screens |
| 16 | Hardening, performance, E2E | Security, coverage, benchmarks, Playwright |
| 17 | Packaging, docs, final audit | Docker, README, PRD audit, v1.0.0 |

---

## Phase 0 — Repository, tooling and spec lock

**Objective.** A clean, runnable monorepo skeleton with every quality tool wired, and confirmation that the governing documents are present.
**PRD refs.** Header, §8.3 (module map), §9, NFR-10, NFR-11.
**Requirements covered.** NFR-10 (portability setup), NFR-11 (tooling), FR-22 (`/healthz` stub).
**Prerequisites.** `docs/PRD.md` and the four governing files exist at the paths above; Python 3.12 and Node 20 installed (record versions; missing = blocker).
**Files.** `backend/pyproject.toml`, `backend/app/**/__init__.py` (packages per §8.3), `backend/app/main.py`, `backend/tests/unit/test_health.py`; `frontend/` Vite React-TS scaffold; `Makefile`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`.
**Tasks.**
1. Verify governing files exist; confirm `docs/PRD.md` ends at §9 and log that `prd-addendum.md` is in force (open issue I-1 stays until the team confirms).
2. `git init` (if needed), `.gitignore` (venv, node_modules, `*.db`, `.env`), first commit.
3. Backend: `pyproject.toml` with §9 dependencies and ADD §9 additions; package skeleton; `GET /healthz` → `{"status":"ok"}`.
4. Configure ruff, mypy (strict for `app/scheduling` and `app/carbon`, standard elsewhere), pytest (`asyncio_mode=auto`, coverage).
5. Frontend: Vite + React 18 + TS, Tailwind (CSS-variable tokens placeholder), React Router, TanStack Query, Vitest + Testing Library, ESLint, Prettier, one smoke test.
6. Makefile targets: `install`, `backend-dev`, `frontend-dev`, `backend-lint`, `backend-test`, `frontend-lint`, `frontend-test`, `frontend-build`, `check`.
7. `.env.example` listing every variable in ADD §8 with safe placeholder values.
8. CI workflow running `make check`.
**Deliverables.** Repo that installs and passes `make check` from a clean clone.
**Integration.** Frontend dev server proxies `/api` to the backend port.
**Validation.** `make install && make check`; `curl /healthz`.
**Acceptance criteria.** AC-0.1 `make check` passes clean. AC-0.2 `/healthz` test passes. AC-0.3 frontend build succeeds. AC-0.4 no secret or `.db` file tracked by git. AC-0.5 toolchain versions recorded in progress file.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 1 — Core infrastructure: config, clock, logging, errors

**Objective.** The cross-cutting foundations every later module depends on.
**PRD refs.** §8.3 (Clock, Logging rows), §8.6, F8, F11 (clock), NFR-09, NFR-13; ADD §1 (R1), §4 (error envelope).
**Requirements covered.** NFR-09, NFR-13, NFR-12 (time determinism support), F8 AC3, F10 (`AUTH_ENABLED` guard).
**Prerequisites.** Phase 0 verified.
**Files.** `app/core/{config,clock,time,logging,errors,middleware}.py`, `tests/unit/core/*`.
**Tasks.**
1. `Settings` via pydantic-settings; fail fast if `AUTH_ENABLED=false` while `DEMO_MODE=false`; fail fast on missing `JWT_SECRET`/`ENCRYPTION_KEY` unless demo.
2. `Clock` protocol; `SystemClock`; `SimulatedClock(speed, anchor_real, anchor_sim, paused)` with `now()`; `set_speed()` and `pause()` re-anchor without time jumps; `real_seconds_for(sim_delta)` helper.
3. Time helpers: require aware UTC, `floor_to_slot()`, `to_iso_z()`.
4. structlog JSON logging with context vars `request_id`, `job_id`, `plan_id`.
5. `request_id` middleware (honor inbound `X-Request-ID`, else uuid4; echo on response).
6. `AppError` hierarchy and handlers: validation → 422 `VALIDATION_ERROR` listing every failing field; HTTP errors; unhandled → 500 `INTERNAL_ERROR` with `request_id`, stack logged. Envelope per ADD §4.
**Deliverables.** Importable core package used by `main.py`.
**Integration.** `main.py` installs middleware and handlers; Clock provided as a FastAPI dependency and app singleton.
**Validation.** `pytest tests/unit/core`; manual request to a 404 and to an invalid body.
**Acceptance criteria.** AC-1.1 at 120x, 1 real second = 2 simulated minutes (test). AC-1.2 speed change and pause are continuous (no jump). AC-1.3 404, 422 (multiple fields) and forced 500 all return the envelope with `request_id`. AC-1.4 log lines are valid JSON with `request_id`. AC-1.5 startup fails for the unsafe auth combination.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 2 — Database and state machine

**Objective.** The persistent model and the job lifecycle rules, enforced in one place.
**PRD refs.** F5, F6 (AC3), §8.5 (queue = `jobs` table), FR-10, FR-11, NFR-04; ADD §2, §3.
**Requirements covered.** FR-11 (events), foundation for FR-10 and NFR-04.
**Prerequisites.** Phase 1 verified.
**Files.** `app/db/{base,session,types,models,repositories,state_machine}.py`, `alembic/`, `tests/integration/db/*`.
**Tasks.**
1. SQLAlchemy 2.0 models for every table in ADD §2; UTC-aware datetime `TypeDecorator`; CHECK-constrained enums; portable types.
2. Engine setup: WAL, `foreign_keys=ON`, `busy_timeout`; session helpers (sync or async, one choice recorded as an ADR).
3. Alembic initial migration (autogenerate, then hand-review).
4. Repositories: jobs, events, plans, decisions, carbon, settings (seeded with F7 defaults), audit, users/api_keys.
5. `state_machine.py`: legal-transition table from ADD §3, `transition()` that updates status and writes the `job_events` row in the same transaction; `claim_scheduled_job()` compare-and-set via `UPDATE … WHERE status='scheduled' AND version=…`.
**Deliverables.** Migrated schema, repositories, enforced lifecycle.
**Integration.** `alembic upgrade head` runs at startup (and via `make migrate`).
**Validation.** `pytest tests/integration/db`; migration up/down on an empty file.
**Acceptance criteria.** AC-2.1 migration applies and reverses cleanly. AC-2.2 every illegal (from,to) pair raises `ILLEGAL_TRANSITION` (parametrized over the full matrix). AC-2.3 each legal transition writes exactly one event. AC-2.4 two concurrent claims start the job once. AC-2.5 settings defaults equal F7. AC-2.6 datetimes round-trip as aware UTC.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 3 — Authentication, API keys, rate limiting

**Objective.** Secure access for UI users and machine clients.
**PRD refs.** F10, FR-19, NFR-05, NFR-06, §9 (auth row); ADD §4, §8.
**Requirements covered.** F10, FR-19, NFR-06, part of NFR-05.
**Prerequisites.** Phases 1–2 verified.
**Files.** `app/core/security.py`, `app/api/{auth,users,api_keys}.py`, `app/api/deps.py`, `tests/integration/auth/*`.
**Tasks.**
1. argon2 password hashing; JWT HS256 (8 h) create/verify.
2. Admin bootstrap from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when no users exist; never log the password.
3. API keys: `gs_` + 32 random bytes (urlsafe); store prefix and SHA-256 only; plaintext returned once.
4. Dependencies `current_principal`, `require_admin`; `X-API-Key` and Bearer both supported; revoked/inactive rejected; `last_used_at` updated.
5. `AUTH_ENABLED=false` yields a synthetic admin principal (demo only, per Phase 1 guard).
6. Routes: `POST /auth/login`, `GET /auth/me`, `POST/GET /users`, `GET/POST /api-keys`, `DELETE /api-keys/{id}`.
7. slowapi limits per ADD §8 with the `RATE_LIMITED` envelope.
**Deliverables.** Working auth layer reusable by all later routers.
**Integration.** All later routers depend on `current_principal`.
**Validation.** `pytest tests/integration/auth`.
**Acceptance criteria.** AC-3.1 protected route: 401 without credentials, 403 for a viewer on an admin route (F10 AC1). AC-3.2 key plaintext appears only in the create response; DB holds no plaintext (F10 AC2). AC-3.3 expired/forged JWT rejected. AC-3.4 login and key-creation rate limits return 429. AC-3.5 viewer cannot create keys or users.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 4 — Carbon data layer

**Objective.** A trustworthy, uniform intensity series with explicit health, working offline.
**PRD refs.** F3, §5.2, §3.3 (J3), FR-05, FR-06, NFR-03, §8.4; ADD §1 (R7), §5 (ladder), §6.
**Requirements covered.** F3, FR-05, FR-06, NFR-03 (provider side), UC3, UC8.
**Prerequisites.** Phases 1–3 verified.
**Files.** `app/carbon/{base,mock,neso,electricity_maps,normalize,service}.py`, `app/api/carbon.py`, `tests/fixtures/neso_*.json`, `tests/unit/carbon/*`.
**Tasks.**
1. `Slot` dataclass and `CarbonProvider` protocol (current, forecast_48h, history, generation).
2. `MockProvider`: deterministic curve per ADD §6 as a pure function of Clock time.
3. `NesoProvider`: httpx async, 5 s connect/read timeouts, 3 retries with exponential backoff and jitter; parse `forecast`, `actual`, `index`; endpoints per F3.
4. Electricity Maps adapter: interface stub that raises `ProviderDisabled`.
5. Normalization: align to :00/:30, de-duplicate, interpolate gaps ≤ 3 slots (flag `interpolated`), larger gaps from same slot 24 h earlier when available.
6. `CarbonService`: `refresh()` (upsert `carbon_observations`, snapshot generation mix), consecutive-failure counter, health and data age per ADD §5 ladder, `get_slots(start, n=96)` merging actual and forecast, cache fallback.
7. Routes `GET /carbon/current|forecast|generation|history` with provider, health, age.
**Deliverables.** Carbon service usable by the planner; carbon endpoints.
**Integration.** Provider chosen from the `carbon_provider` setting (Phase 2 settings); `refresh()` is called by the Phase 9 loop.
**Validation.** `pytest tests/unit/carbon` using respx and fixtures.
**Acceptance criteria.** AC-4.1 fixtures parse to the expected `Slot` values (F3 AC1). AC-4.2 three consecutive failures → `degraded`, last good forecast still served (F3 AC2). AC-4.3 interpolation and 24 h fill covered by tests. AC-4.4 no provider failure produces a 500 (NFR-03). AC-4.5 mock curve is deterministic and shows trough < solar dip < evening peak. AC-4.6 every carbon response carries provider name and data age (F3 AC3 backend half). AC-4.7 ≥ 80% coverage on `app/carbon`.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 5 — Optimization core (pure functions)

**Objective.** A correct, deterministic, I/O-free scheduler with fallbacks.
**PRD refs.** F4, F8, §8.3 (optimizer row), §8.5 (optimizer row), FR-07, FR-08, FR-16, NFR-01, NFR-12; ADD §5.
**Requirements covered.** FR-07, FR-08, FR-16, NFR-12, NFR-01 (solver side).
**Prerequisites.** Phase 1 verified (no DB needed).
**Files.** `app/scheduling/{types,model,solver,greedy,validate}.py`, `tests/unit/scheduling/*`.
**Tasks.**
1. Dataclasses: `OptJob`, `Reservation`, `Problem` (slot intensities, capacity, settings), `Plan`.
2. Feasible-start-set builder and cost matrix per ADD §5 (including fractional last slot, delay penalty, stickiness, tie-break epsilon).
3. Non-deferrable pre-pass (fixed reservations) and `deadline_infeasible` preflight.
4. Sparse constraint assembly; `scipy.optimize.milp` with 5 s limit; result extraction.
5. `linprog` relaxation for `lp_bound` and `gap`.
6. Greedy fallback and ASAP/EDF fallback.
7. `validate_plan()` guard and `solve()` wrapper implementing the fallback chain; returns solver, status, objective, bound, gap, duration.
**Deliverables.** `solve(problem) -> Solution`, no I/O, no Clock reads.
**Integration.** Consumed by the Phase 6 planner and the Phase 7 preview.
**Validation.** `pytest tests/unit/scheduling`; benchmark script `scripts/bench_solver.py`.
**Acceptance criteria.** AC-5.1 single-trough fixture: flexible job starts in the trough (F4 AC1). AC-5.2 Hypothesis: no solver ever exceeds capacity or breaks deadline/earliest/delay cap (F4 AC2). AC-5.3 deadline = earliest finish starts immediately (F4 AC3). AC-5.4 identical inputs give identical plans (F4 AC4). AC-5.5 forced MILP exception yields a valid `greedy` plan (F8 AC1). AC-5.6 200 jobs × 96 slots solves within the time limit; measured duration recorded. AC-5.7 ≥ 80% coverage on `app/scheduling`.
**Definition of Done.** GDoD.
**Gate.** GDoD, plus benchmark number written to `build-progress.md`.

## Phase 6 — Planner, decisions, explanations, estimates

**Objective.** Turn DB state plus carbon data into persisted, explained plans.
**PRD refs.** F4, F6, F8, §8.2, §8.6, FR-09 (trigger plumbing), FR-12, FR-17 (planned/baseline), NFR-09, NFR-12; ADD §5.
**Requirements covered.** F6, FR-12, FR-17 (baseline/planned), FR-07 integration, NFR-12 (end to end), UC2, UC4 (data side).
**Prerequisites.** Phases 2, 4, 5 verified.
**Files.** `app/scheduling/{planner,explain,estimates}.py`, `app/services/plan_service.py`, `tests/integration/scheduling/*`.
**Tasks.**
1. `planner.plan(trigger)` under one in-process asyncio lock: load active jobs, running reservations, settings, slots, data health.
2. Staleness ladder: `unavailable` → fail-safe policy (ASAP) and `DEGRADED_DATA_FALLBACK` on every decision.
3. Persist atomically: new `schedule_plans` row; prior plan and decisions `is_current=false`; new decisions; update job planned times, `pending_plan → scheduled` via the state machine; `planned`/`replanned` events.
4. `estimates.py`: baseline, planned, saved gCO2e per ADD §5.
5. `explain.py`: one deterministic template per reason code; reason-code precedence from ADD §5; numbers read from stored fields.
6. Per-plan structured log: solver, status, objective, bound, gap, variables, duration (NFR-09).
7. `PlanService.request_plan(trigger, wait_for_job_id=None)` with leading-edge debounce and coalescing (ADD R4).
**Deliverables.** `PlanService` the API and background loops can call.
**Integration.** Uses `CarbonService`, repositories, `solve()`. Trigger callers arrive in Phases 7–9.
**Validation.** `pytest tests/integration/scheduling`.
**Acceptance criteria.** AC-6.1 every decision has code and text (F6 AC1). AC-6.2 numbers in text equal stored fields (F6 AC2). AC-6.3 superseded decisions kept with `is_current=false` (F6 AC3). AC-6.4 replanning unchanged inputs gives identical decisions apart from ids and timestamps. AC-6.5 a 6-hour outage produces ASAP plans, all `DEGRADED_DATA_FALLBACK` (F8 AC2 backend half). AC-6.6 each reason code is reachable by a test fixture. AC-6.7 plan logs carry the required fields.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 7 — Job intake and preview API

**Objective.** The proxy's front door: validated, idempotent, safe job submission, plus what-if preview.
**PRD refs.** F1, F2, F12, FR-01 to FR-04, FR-21, NFR-05, §8.4; ADD §4.
**Requirements covered.** F1, F2, F12, FR-01–04, FR-21, UC1, UC2, UC9, part of NFR-05.
**Prerequisites.** Phases 3, 6 verified.
**Files.** `app/services/{intake,ssrf}.py`, `app/core/crypto.py`, `app/api/{jobs,schedule}.py`, `app/api/schemas/jobs.py`, `tests/integration/jobs/*`, `tests/unit/test_ssrf.py`.
**Tasks.**
1. `JobCreate` schema with every F2 rule and field-level messages; defaults (`power_kw` from watts-per-unit table, `earliest_start_at`, PUE) echoed in `defaults_applied`.
2. Forward-target validation: HTTPS only unless `ALLOW_HTTP_TARGETS`, host allowlist, resolve host and reject private/loopback/link-local/multicast/reserved (IPv4, IPv6, IPv4-mapped), body ≤ 64 KB, ≤ 20 headers, method whitelist; `TARGET_NOT_ALLOWED`.
3. Fernet-encrypt stored headers; never return values.
4. Idempotency: same `Idempotency-Key` and principal returns the original job with 200, no new row.
5. `POST /jobs`: persist `pending_plan` plus `submitted` event before acknowledging; call `request_plan(wait_for_job_id)` and wait up to 3 s; return 202 with job and decision when ready.
6. `GET /jobs` (filters, pagination), `GET /jobs/{id}`, `/events`, `/decisions`.
7. `POST /schedule/preview` using planner problem-building in read-only mode: best window, expected and baseline intensity, saving, top 3 alternatives (distinct windows); `GET /schedule/current`.
**Deliverables.** Complete intake and read API for jobs and preview.
**Integration.** Rate limits from Phase 3; planner from Phase 6.
**Validation.** `pytest tests/integration/jobs`; benchmark of 100 submissions at 50 active jobs.
**Acceptance criteria.** AC-7.1 202 in under 500 ms without plan wait; decision included within 3 s in ≥ 95% of 100 submissions at 50 active jobs (F1 AC1). AC-7.2 repeated key → 200, no new row (F1 AC2). AC-7.3 422 lists every failing field (F1 AC3). AC-7.4 private-address target → `TARGET_NOT_ALLOWED` (F1 AC4), including IPv6 and mapped forms. AC-7.5 each F2 rule has a negative test; defaults echoed (F2 AC1–2). AC-7.6 preview writes nothing (F12 AC1) and equals the later schedule when nothing changes (F12 AC2). AC-7.7 header values never appear in any response or log.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 8 — Dispatcher and executors

**Objective.** Run jobs exactly once at their planned time and record results.
**PRD refs.** F5, F8, §8.2, §8.4, FR-03, FR-10, FR-11, FR-15, NFR-04; ADD §3.
**Requirements covered.** F5, FR-03 (execution), FR-10, FR-15, NFR-04, FR-17 (realized).
**Prerequisites.** Phases 2, 6, 7 verified.
**Files.** `app/execution/{base,simulated,forward,dispatcher,reconcile}.py`, `tests/integration/execution/*`.
**Tasks.**
1. `Executor` protocol; `SimulatedExecutor` (progress derived from Clock, no external effect).
2. `ForwardExecutor`: decrypt headers, re-validate target at send time, no redirects, 30 s timeout, 2xx = success, record status and error.
3. `Dispatcher.tick()`: select due `scheduled` jobs (ordered by planned start, id), claim by compare-and-set, execute, finalize finished simulated jobs.
4. Retry path: failure → `retry_wait` with 30 s / 2 min / 10 min on the Clock, then `failed`.
5. On success write `job_runs`, compute realized gCO2e from actual intensity (fall back to forecast, labelled), call `request_plan("completion")`.
6. `reconcile()` at startup: simulated `running` resumes from the Clock; forward `running` → `failed` (`INTERRUPTED`) → `retry_wait`.
**Deliverables.** `Dispatcher` and executors callable by the Phase 9 loop.
**Integration.** `PlanService` for completion re-plan; carbon service for actual intensity.
**Validation.** `pytest tests/integration/execution` with a local echo ASGI app or respx.
**Acceptance criteria.** AC-8.1 concurrent ticks start a job once (F5 AC1). AC-8.2 legal state order and one event per transition (F5 AC2). AC-8.3 restart reconciliation behaves as specified (F5 AC3, NFR-04). AC-8.4 retries fire at 30 s/2 min/10 min on the simulated clock then fail (FR-15). AC-8.5 forward success and failure recorded in `job_runs`. AC-8.6 realized gCO2e stored and distinguishable from forecast-based.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 9 — Background loops, manual controls, settings, system endpoints

**Objective.** Make the system run itself and give operators control.
**PRD refs.** F7, F8, §8.3 (Background row), FR-09, FR-13, FR-14, FR-22, UC5, UC6; ADD §1 (R10), §4, §8.
**Requirements covered.** F7, FR-09 (all triggers), FR-13, FR-14, FR-22, NFR-03 (carbon loop).
**Prerequisites.** Phases 4, 6, 8 verified.
**Files.** `app/core/background.py`, `app/services/controls.py`, `app/api/{settings,system,audit}.py`, additions to `app/api/jobs.py`, `tests/integration/ops/*`.
**Tasks.**
1. APScheduler loops: carbon refresh 15 min (plus once at startup), dispatch tick 5 s real time, heartbeat re-plan 15 min, daily retention of old `carbon_observations`; `max_instances=1`, coalesce, graceful shutdown, heartbeat timestamp.
2. Wire all re-plan triggers: submit (done), cancel, completion (done), forecast change, settings change, heartbeat, replan-all, startup.
3. Controls: `cancel` (owner/admin), `run-now` (capacity check; else 409 `NO_CAPACITY` with `next_feasible_at`; reason `MANUAL_OVERRIDE`), `retry`, admin `POST /schedule/replan`.
4. Settings `GET/PUT` with validated ranges (ADD §4), audit rows, triggers one re-plan; `GET /audit`.
5. `GET /system/status`; `/healthz` and `/readyz` per R10.
**Deliverables.** A backend that operates unattended and is fully controllable by API.
**Integration.** Startup order: migrate → reconcile → carbon refresh → scheduler start.
**Validation.** `pytest tests/integration/ops`; manual run of the app for 2 minutes at 120x.
**Acceptance criteria.** AC-9.1 settings changes apply on the next plan and trigger exactly one (F7 AC1); invalid values 422 (AC2); every change audited with user and timestamp (AC3). AC-9.2 each FR-09 trigger demonstrably causes a plan (one test each). AC-9.3 viewer gets 403 on settings write and on others' cancel. AC-9.4 `NO_CAPACITY` body includes `next_feasible_at`. AC-9.5 `/readyz` returns 503 only when DB or scheduler fails. AC-9.6 scheduler shuts down cleanly with no duplicate instances.
**Definition of Done.** GDoD.
**Gate.** GDoD, plus a recorded 2-minute unattended run without errors.

## Phase 10 — Analytics and export

**Objective.** Honest, reconcilable savings numbers and CSV.
**PRD refs.** F9, §4 (metrics), §2.5, FR-17, FR-18, UC7, J2; ADD §5.
**Requirements covered.** F9, FR-17 (aggregates), FR-18.
**Prerequisites.** Phases 6, 8 verified.
**Files.** `app/services/analytics.py`, `app/api/analytics.py`, `tests/integration/analytics/*`.
**Tasks.**
1. Per-job figures: baseline, planned, realized, basis label (`forecast`|`realized`).
2. `refresh_realized()` after each carbon refresh for finished jobs whose actual intensity became available.
3. Aggregations by day, workload type, priority: jobs, avoided gCO2e, percent reduction, average delay, on-time rate, share shifted (formulas per §4).
4. `GET /analytics/summary` with range validation; empty range returns zeros.
5. `GET /analytics/export.csv` mirroring the summary, formula-injection-safe.
**Deliverables.** Analytics API and CSV.
**Integration.** Called from the Phase 9 carbon-refresh loop.
**Validation.** `pytest tests/integration/analytics`.
**Acceptance criteria.** AC-10.1 aggregates equal sums of per-job figures (F9 AC1). AC-10.2 every figure carries a *forecast-based* or *realized* label (F9 AC2). AC-10.3 CSV equals API data (F9 AC3). AC-10.4 metric formulas match §4 definitions (test with hand-computed case). AC-10.5 CSV cells beginning `= + - @` are neutralized.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 11 — Demo mode backend

**Objective.** A reproducible, accelerated, dependency-free demonstration.
**PRD refs.** F11, §1, §4 (metrics), §8.4, FR-20, UC10; ADD §1 (R1, R7), §4.
**Requirements covered.** F11, FR-20, goal G4, ≥ 20% reduction metric, time-to-demo metric (backend part).
**Prerequisites.** Phases 4, 8, 9, 10 verified.
**Files.** `app/demo/{routes,scenarios,seed}.py`, `demo/echo_target.py`, `Makefile` (`demo`), `tests/integration/demo/*`.
**Tasks.**
1. `DEMO_MODE` wiring: SimulatedClock at `SIM_SPEED` (default 120), mock provider, optional auth bypass.
2. Routes per ADD §4 (state, clock speed/pause, scenarios, reset, seed, outage); all 404 when demo is off.
3. Scenarios with fixed anchor time and `uuid5` ids: `overnight_batch`, `deadline_crunch`, `capacity_crunch`, `data_outage`, `mixed_day`.
4. Reset: clear jobs/plans/decisions/events/runs, restore default settings, reseed.
5. `demo/echo_target.py`: one-route FastAPI that records arrivals with timestamps and lists them.
6. `make demo`: migrate, seed, start backend, echo target and frontend dev server (frontend part may be a no-op until Phase 12).
**Deliverables.** Deterministic demo backend and one-command start.
**Integration.** Forward-mode scenario targets the echo service on an allowed host (`ALLOW_HTTP_TARGETS`/allowlist set in demo env only).
**Validation.** `pytest tests/integration/demo`; run `make demo` and watch a scenario complete.
**Acceptance criteria.** AC-11.1 `make demo` yields a populated system (F11 AC1). AC-11.2 `overnight_batch` yields a byte-identical plan across 3 runs (F11 AC2). AC-11.3 demo routes 404 when off (F11 AC3). AC-11.4 seeded scenario shows ≥ 20% estimated reduction (§4). AC-11.5 outage scenario triggers `degraded` then fail-safe on schedule. AC-11.6 echo target receives a forwarded request at the planned simulated time.
**Definition of Done.** GDoD.
**Gate.** GDoD, plus the backend is feature-complete: all FR except UI-only items verified.

## Phase 12 — Frontend foundation

**Objective.** An accessible, themed app shell with typed API access and shared states.
**PRD refs.** §9 (frontend rows), NFR-02, NFR-07, NFR-08, NFR-13, F3 AC3, F11 (chip); ADD §7.
**Requirements covered.** NFR-07, NFR-08, NFR-13, FR-06 (UI), part of FR-19 (UI).
**Prerequisites.** Phase 9 verified (Phase 11 for the demo chip).
**Files.** `frontend/src/{lib/{api,auth,time,format},components/ui/*,layout/*,routes/*,styles/tokens.css}`, `make api-types`.
**Tasks.**
1. CSS-variable design tokens, light/dark, five intensity bands with text labels; verify AA contrast.
2. Radix-based primitives: Button, Card, Badge, Dialog, Tabs, Select, Input, Toast, Tooltip, Skeleton.
3. `openapi-typescript` generation from the backend OpenAPI into `src/lib/api-types.ts`; typed fetch client with error-envelope parsing and `request_id` surfacing.
4. TanStack Query provider (5 s polling for live data); login page; token handling; 401 → logout; role-gated routes.
5. App shell: nav, skip link, theme toggle, UTC/local toggle (persisted), DEMO chip, data-health banner (provider, age), error boundary.
6. `LoadingState`, `EmptyState`, `ErrorState` components.
**Deliverables.** Empty but fully wired screens for all routes.
**Integration.** Dev proxy to backend; types regenerated by `make api-types`.
**Validation.** `make frontend-test frontend-build`; axe on the shell; manual login against the running backend.
**Acceptance criteria.** AC-12.1 auth guard redirects and 401 logs out. AC-12.2 viewer does not see admin nav. AC-12.3 UTC toggle changes all rendered times. AC-12.4 degraded data shows the banner with age. AC-12.5 axe reports no violations on shell; keyboard-only navigation reaches all nav items. AC-12.6 intensity band colors meet AA contrast and always show text.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 13 — Dashboard and carbon timeline

**Objective.** The signature 48-hour timeline and grid-state overview.
**PRD refs.** §1, F3 AC3, F6, §2.5, UC3, NFR-02, NFR-08; ADD §7.
**Requirements covered.** UC3, NFR-08, FR-06 (UI), part of NFR-02.
**Prerequisites.** Phase 12 verified.
**Files.** `frontend/src/features/dashboard/*`, `features/timeline/{CarbonTimeline,layout,lanes}.tsx|ts`.
**Tasks.**
1. Grid state card: current intensity, band label, provider, data age, renewable share (tooltip: context only, not optimized).
2. KPI cards: jobs by status, estimated avoided gCO2e with basis label, next scheduled job.
3. `CarbonTimeline` (custom SVG): 96 cells, bands with colour and label, "now" marker, hover and focus tooltips.
4. Job bars: pure layout function (start/end → x/width) and deterministic lane packing; status styling; click to job detail.
5. Upcoming/running list; 5 s polling; loading, empty, error states.
**Deliverables.** Live dashboard.
**Integration.** `GET /carbon/forecast` and `GET /schedule/current`.
**Validation.** Vitest on layout and lane functions plus component tests; visual check in demo mode.
**Acceptance criteria.** AC-13.1 renders 96 cells from a fixture with correct band labels. AC-13.2 bar position/width match start and duration (unit test). AC-13.3 lane packing never overlaps. AC-13.4 tooltips are keyboard reachable; axe clean. AC-13.5 timeline updates after a plan change within one polling cycle. AC-13.6 grid view shows provider and data age.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 14 — Jobs views and submission

**Objective.** Inspect, control and submit jobs, with a live recommendation.
**PRD refs.** F1, F2, F5, F6, F7, F12, J1, UC1, UC2, UC4, UC5, UC9; ADD §4, §7.
**Requirements covered.** UC1, UC2, UC4, UC5, UC9 (UI side of F1, F2, F6, F7, F12).
**Prerequisites.** Phase 13 verified.
**Files.** `frontend/src/features/jobs/*`, `features/submit/*`.
**Tasks.**
1. Jobs list: filters, pagination, status badges, planned start, estimated saving with label.
2. Job detail: spec, status timeline from events, decision card (reason chip, explanation, numbers, label), baseline vs planned comparison, superseded decision history.
3. Controls with confirm dialogs: cancel, run now (surface `NO_CAPACITY` and next time), retry.
4. Submit form (react-hook-form + zod mirroring F2); workload defaults hint; execution mode with target fields; per-attempt idempotency key.
5. Live preview panel (400 ms debounce) with best window, baseline, saving, 3 alternatives, mini timeline highlight.
6. Map server 422 `details` onto form fields; on success navigate to the job.
**Deliverables.** End-to-end job UX.
**Integration.** `POST /jobs`, `POST /schedule/preview`, controls endpoints.
**Validation.** RTL tests; manual J1 walk-through in demo mode.
**Acceptance criteria.** AC-14.1 each F2 rule has a client-side test and the server 422 maps to fields. AC-14.2 preview updates with form changes and agrees with the planned window after submit. AC-14.3 cancel, run now, retry flows work, including the `NO_CAPACITY` message. AC-14.4 decision card numbers equal API fields. AC-14.5 axe clean on list, detail, form.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 15 — Analytics, settings, system and demo UIs

**Objective.** Finish the remaining screens.
**PRD refs.** F7, F9, F10, F11, J2, J3, UC6, UC7, UC8, UC10, NFR-07; ADD §4, §7.
**Requirements covered.** UC6, UC7, UC8, UC10, F9 UI, F10 UI, F11 UI.
**Prerequisites.** Phase 14 verified.
**Files.** `frontend/src/features/{analytics,settings,system,demo}/*`.
**Tasks.**
1. Analytics: range picker (default 7 days), KPI cards, Recharts daily and by-type/priority charts, table, labels on every figure, authorized CSV download.
2. Settings (admin): all F7 settings with validation and change confirmation; audit list; API keys (create with one-time reveal and copy, list, revoke); users (create).
3. System: provider and data health, scheduler heartbeat, last plan stats (solver, status, objective, bound, gap, variables, duration).
4. Demo panel (only when the flag is on): clock speed and pause, scenario buttons, reset, seed, outage toggle, link to the echo target's received list.
**Deliverables.** Complete UI surface.
**Integration.** `/analytics/*`, `/settings`, `/audit`, `/api-keys`, `/users`, `/system/status`, `/demo/*`.
**Validation.** RTL tests per page; manual J2 and J3 walk-throughs.
**Acceptance criteria.** AC-15.1 CSV from UI equals API data. AC-15.2 viewer cannot reach settings or key pages. AC-15.3 key plaintext displayed once and not retrievable. AC-15.4 demo panel absent when demo is off. AC-15.5 every analytics number labelled *forecast-based* or *realized*. AC-15.6 axe clean on all four pages.
**Definition of Done.** GDoD.
**Gate.** GDoD only.

## Phase 16 — Hardening, performance and end-to-end

**Objective.** Prove the system meets its non-functional targets and works end to end.
**PRD refs.** §4 (metrics), NFR-01, NFR-02, NFR-03, NFR-05, NFR-06, NFR-07, NFR-11; F1 AC1; all journeys.
**Requirements covered.** NFR-01, NFR-02, NFR-03, NFR-05, NFR-06, NFR-07, NFR-11, success metrics (latency, on-time, coverage).
**Prerequisites.** Phases 0–15 verified.
**Files.** `frontend/e2e/*` (Playwright), `scripts/{bench_plan,bench_api,security_check}.py`, test additions.
**Tasks.**
1. Security pass: CORS restricted, security headers via nginx config draft, SSRF suite (IPv6, mapped, redirect not followed, DNS re-check), secrets scan, header-encryption test, log redaction test, rate-limit tests.
2. Close coverage gaps to ≥ 80% on `scheduling` and `carbon`; ruff and mypy clean everywhere.
3. Benchmarks: 200-job plan time; p95 non-planning API latency; p95 submission-to-decision at ≤ 200 jobs; dashboard first contentful render. Record numbers.
4. Playwright: login → submit → see window → timeline shows job → advance demo clock → job succeeds → analytics shows saving; outage banner path (J3); viewer-vs-admin permissions.
5. Accessibility sweep: axe on every route, keyboard-only walkthrough.
6. Fix defects found; re-run the entire suite.
**Deliverables.** Green full suite and recorded benchmark table.
**Integration.** None new.
**Validation.** `make check`, `make e2e`, bench scripts.
**Acceptance criteria.** AC-16.1 200-job plan ≤ 5 s. AC-16.2 p95 non-planning latency < 200 ms. AC-16.3 p95 decision latency < 3 s for ≤ 200 jobs. AC-16.4 dashboard FCP < 2 s locally. AC-16.5 on-time completion ≥ 99% in the simulated feasible scenario. AC-16.6 E2E scenarios pass. AC-16.7 no axe violations on any page. AC-16.8 coverage target met. AC-16.9 no 500 caused by provider failure in chaos test.
**Definition of Done.** GDoD plus benchmark table in `build-progress.md`.
**Gate.** GDoD; any missed target must be fixed or recorded as an explicit, user-visible known gap.

## Phase 17 — Packaging, documentation and final audit

**Objective.** One-command delivery and a verified PRD traceability audit.
**PRD refs.** §1, §2.5, §4 (time to demo), §5.3, NFR-10; F11.
**Requirements covered.** NFR-10, time-to-demo metric, documentation deliverables, goals G1–G4 audit.
**Prerequisites.** Phase 16 verified.
**Files.** `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `README.md`, `docs/DEMO_SCRIPT.md`, `docs/prd-audit.md`, `.github/workflows/ci.yml`.
**Tasks.**
1. Multi-stage Docker builds; nginx serves the SPA and proxies `/api`; compose with a persistent SQLite volume and a `demo` profile including the echo target.
2. CI: lint, test, build, optional e2e.
3. README: purpose, honest framing (§2.5), quick start (docker and native), configuration table, API overview, architecture diagram, limitations (§5.3), future work (F13, F14).
4. `docs/DEMO_SCRIPT.md`: a 5-minute walkthrough covering J1, J2, J3.
5. Audit: walk the traceability matrix below; mark every in-scope requirement `VERIFIED`, `PARTIAL` or `GAP` with evidence in `docs/prd-audit.md`.
6. Time a clean-clone-to-demo run.
7. Tag `v1.0.0`.
**Deliverables.** Shippable repository and audit report.
**Integration.** Compose environment mirrors `.env.example`.
**Validation.** `docker compose up` from a clean clone; `make demo`; audit review.
**Acceptance criteria.** AC-17.1 clean clone to running demo in under 10 minutes with one command. AC-17.2 compose services healthy. AC-17.3 audit has no unexplained `GAP`. AC-17.4 README matches actual commands (each command executed once). AC-17.5 `v1.0.0` tag exists.
**Definition of Done.** GDoD.
**Gate.** Project complete when the user accepts the audit.

---

## Traceability matrix (every in-scope PRD requirement → phase)

| Requirement | Phase(s) |
|---|---|
| F1 | 7 (+14 UI) |
| F2 | 7 (+14 UI) |
| F3 | 4 (+12, 13 UI) |
| F4 | 5, 6 |
| F5 | 2, 8 |
| F6 | 6 (+14 UI) |
| F7 | 9 (+15 UI) |
| F8 | 4, 5, 8 (+1 handler) |
| F9 | 10 (+15 UI) |
| F10 | 3 (+12, 15 UI) |
| F11 | 11 (+15 UI) |
| F12 | 7 (+14 UI) |
| F13, F14 | Out of scope (documented in README, Phase 17) |
| FR-01, 02, 03 (intake), 04 | 7 |
| FR-03 (execution) | 8 |
| FR-05, FR-06 | 4 (+12 UI) |
| FR-07, FR-08, FR-16 | 5, 6 |
| FR-09 | 6 (plumbing), 7 (submit), 8 (completion), 9 (rest) |
| FR-10, FR-15 | 8 |
| FR-11 | 2, 8 |
| FR-12 | 6 |
| FR-13, FR-14 | 9 |
| FR-17 | 6 (baseline/planned), 8 (realized), 10 (aggregate) |
| FR-18 | 10 |
| FR-19 | 3 |
| FR-20 | 11 (+15 UI) |
| FR-21 | 7 |
| FR-22 | 0 (stub), 9 |
| NFR-01 | 5, 16 |
| NFR-02 | 13, 16 |
| NFR-03 | 4, 6, 16 |
| NFR-04 | 2, 8 |
| NFR-05 | 3, 7, 16 |
| NFR-06 | 3, 16 |
| NFR-07 | 12–15, 16 |
| NFR-08 | 12, 13 |
| NFR-09 | 1, 6 |
| NFR-10 | 0, 17 |
| NFR-11 | 0, 16 |
| NFR-12 | 5, 6 |
| NFR-13 | 1, 12 |
| UC1, UC2 | 7, 14 |
| UC3 | 4, 13 |
| UC4 | 6, 14 |
| UC5 | 9, 14 |
| UC6 | 9, 15 |
| UC7 | 10, 15 |
| UC8 | 4, 6, 12, 15 |
| UC9 | 7, 14 |
| UC10 | 11, 15 |
| Journeys J1, J2, J3 | 14, 15, 15 (verified E2E in 16) |
| Metrics: ≥ 20% reduction | 11 |
| Metrics: ≥ 99% on-time | 16 |
| Metrics: p95 decision latency | 16 |
| Metrics: 100% explained decisions | 6 |
| Metrics: data freshness | 4, 9 |
| Metrics: time to demo | 17 |
| Goals G1–G4 | audited in 17 |
