# prd-addendum.md — Derived Contracts for GreenShift

*Created 2026-10-14. Status: **DERIVED, pending team confirmation.***

## 0. Why this file exists

`docs/PRD.md` declares itself 20 sections long and says "Sections 8 to 12 are the build contract" and that the **database schema (§11) and API contract (§12) win** on conflict. The delivered file stops after §9. These are absent: **§10 Scheduling and Optimization Logic, §11 Database Design, §12 API Design, §13 UI/UX, §14 Security/Reliability, §15 Testing, §16 Delivery Plan, §17 Documentation/Deployment, §18 Risks, §19 Glossary, §20 Checklist.**

Many sections still cite them (`10.7` staleness ladder, `11.4` transitions, `12.2` error body). This addendum reconstructs only what the present PRD text implies, so phases can proceed without silent invention.

**Authority order:** `docs/PRD.md` (as present) > this addendum > `implementation-plan.md` > agent judgement (recorded as an ADR in `build-progress.md`).

**If the original §10–20 are supplied:** save them as `docs/PRD-sections-10-20.md`, mark the matching addendum sections `SUPERSEDED BY PRD §x`, reconcile differences, and log the reconciliation in `build-progress.md`. Items marked **(D)** below are the derived choices most likely to differ.

## 1. Resolved PRD ambiguities

| # | Issue in PRD | Resolution |
|---|---|---|
| R1 | F11 text on demo speed is self-contradictory; §1 claims "a full day in about five minutes", but 120x gives 12 minutes | Default `SIM_SPEED=120` (F11's explicit final statement). Allowed range 1–3600. UI offers a 288x preset ("one day in 5 min"). |
| R2 | Settings `lambda_*` are "gCO2/kWh per hour" | Delay penalty (gCO2e) = `lambda_priority × delay_hours × job_energy_kwh`. Units check out. **(D)** |
| R3 | Non-deferrable jobs "ignore the deadline" but still need capacity | Pre-pass places them at the earliest capacity-feasible slot (ordered by `earliest_start_at`, id) and treats them as fixed reservations for the MILP. Reason `NON_DEFERRABLE`. Never rejected. **(D)** |
| R4 | §8.2 debounces planning by 2 s but F1 wants a decision within 3 s | Leading-edge debounce: first trigger after a quiet period plans immediately; triggers within 2 s coalesce into one trailing plan. **(D)** |
| R5 | F10 says viewers manage "their own jobs", and API clients are viewers | `jobs.created_by_user_id` (API keys belong to a user and inherit at most that user's role). "Own" = same `created_by_user_id`. Admins can act on any job. |
| R6 | F5 AC3: interrupted forward job is "marked `failed`... and retried" | `running → failed` (reason `INTERRUPTED`) then system transition `failed → retry_wait` while attempts remain. See §3. |
| R7 | `carbon_provider` setting vs `DEMO_MODE` | `DEMO_MODE=true` sets the initial provider to `mock`; an admin may switch to `neso` at runtime (live-data demo, §8.4). |
| R8 | Planning horizon is 48 h but deadlines reach 7 days | Variables cover 96 slots from the current slot. Deadlines beyond the horizon are truncated to it and re-planned as it rolls. Jobs with no feasible in-horizon slot go to the ASAP post-pass (`CAPACITY_CONSTRAINED`). |
| R9 | NFR-05 needs encryption at rest; §9 lists no library | `cryptography` (Fernet), key from `ENCRYPTION_KEY`. See §9 for other permitted additions. |
| R10 | PRD requires `/healthz` and `/readyz` but no semantics | `/healthz`: process alive → 200. `/readyz`: 503 only if DB or scheduler heartbeat fails; carbon `degraded`/`unavailable` returns 200 with `status:"degraded"` (NFR-03). **(D)** |

## 2. Data model (derived §11)

All timestamps UTC, timezone-aware in Python, ISO-8601 with `Z` in JSON. IDs are UUID strings (demo scenarios use `uuid5` for determinism). Enums are `CHECK`-constrained strings. Use portable types only (Postgres-compatible).

| Table | Columns |
|---|---|
| `users` | id, email (unique), password_hash (argon2), role (`admin`\|`viewer`), is_active, created_at |
| `api_keys` | id, user_id→users, name, key_prefix (8 chars), key_hash (SHA-256 of full key), role (≤ owner's), created_at, last_used_at, revoked_at |
| `jobs` | id, name, description, workload_type, priority, deferrable, duration_minutes, resource_units, power_kw (resolved, never null), power_kw_source (`provided`\|`default`), pue_used, energy_kwh (= power_kw × pue × duration/60), earliest_start_at, deadline_at (nullable), execution_mode (`simulated`\|`forward`), target_url, target_method, target_headers_enc, target_body, status, planned_start_at, planned_end_at, started_at, finished_at, attempts, last_error, deadline_infeasible, baseline_gco2e, planned_gco2e, realized_gco2e (nullable), created_by_user_id, created_via (`ui`\|`api_key`), api_key_id (nullable), idempotency_key (nullable; unique with created_by_user_id), version (int, optimistic lock), created_at, updated_at |
| `job_events` | id, job_id, ts, from_status (nullable), to_status, event_type, actor (`system`\|`user:<id>`\|`api_key:<id>`), reason_code (nullable), detail_json |
| `job_runs` | id, job_id, attempt, started_at, finished_at, outcome (`running`\|`succeeded`\|`failed`), http_status, error, avg_actual_intensity, realized_gco2e |
| `schedule_plans` | id, created_at, trigger (`submit`\|`cancel`\|`completion`\|`forecast`\|`settings`\|`heartbeat`\|`manual`\|`startup`), solver (`milp`\|`greedy`\|`asap`), solver_status, objective, lp_bound, gap, n_jobs, n_vars, duration_ms, data_health, data_age_minutes, horizon_start, horizon_end, is_current, settings_snapshot_json |
| `scheduling_decisions` | id, plan_id, job_id, is_current, planned_start_at, delay_minutes, reason_code, explanation, expected_avg_intensity, baseline_avg_intensity, baseline_gco2e, planned_gco2e, saved_gco2e, slack_minutes, data_degraded, created_at |
| `carbon_observations` | id, provider, period_start, period_end, forecast_gco2_kwh, actual_gco2_kwh (nullable), index_label, interpolated, fetched_at, source (`live`\|`cache`\|`mock`); **unique (provider, period_start)** |
| `generation_mix_snapshots` | id, provider, fetched_at, mix_json, renewable_share_pct (= wind + solar + hydro; display only) |
| `settings` | key (pk), value_json, updated_by, updated_at |
| `audit_log` | id, ts, actor, action (`setting_changed`\|`key_created`\|`key_revoked`\|`user_created`\|`replan_all`\|`demo_reset`...), target, before_json, after_json |

Indexes: `jobs(status, planned_start_at)`, `jobs(created_by_user_id)`, `job_events(job_id, ts)`, `scheduling_decisions(job_id, is_current)`, `carbon_observations(provider, period_start)`.
Engine: SQLite WAL, `foreign_keys=ON`, `busy_timeout`. Default settings are F7's values.

## 3. Job state machine (derived §11.4)

| From | To | Trigger / actor |
|---|---|---|
| (new) | `pending_plan` | submission |
| `pending_plan` | `scheduled` | planner (decision stored) |
| `pending_plan`, `scheduled`, `retry_wait` | `cancelled` | user cancel (owner or admin) |
| `scheduled` | `running` | dispatcher CAS when `planned_start_at ≤ now`, or Run now |
| `running` | `succeeded` | executor success |
| `running` | `retry_wait` | forward failure with retries left (delays 30 s, 2 min, 10 min on the Clock) |
| `running` | `failed` | retries exhausted, or reconcile after restart (forward, reason `INTERRUPTED`) |
| `retry_wait` | `running` | dispatcher when retry time reached |
| `failed` | `retry_wait` | system, only for `INTERRUPTED` while attempts remain |
| `failed` | `pending_plan` | manual Retry (resets `attempts`) |

Terminal: `succeeded`, `cancelled`. Anything else raises `409 ILLEGAL_TRANSITION`. Every transition writes exactly one `job_events` row in the same transaction. A re-plan that only moves `planned_start_at` writes event `replanned` with no status change.

## 4. API contract (derived §12)

Base path `/api/v1`; `/healthz` and `/readyz` at root. Auth: `Authorization: Bearer <JWT>` or `X-API-Key`. Roles: A = admin only, V = any authenticated.

**Error envelope (12.2)** — every non-2xx:
```json
{"error": {"code": "VALIDATION_ERROR", "message": "…", "details": [{"field": "deadline_at", "message": "…"}], "request_id": "…"}}
```
Codes: `VALIDATION_ERROR`(422), `TARGET_NOT_ALLOWED`(422), `UNAUTHENTICATED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `ILLEGAL_TRANSITION`(409), `NO_CAPACITY`(409, adds `next_feasible_at`), `RATE_LIMITED`(429), `INTERNAL_ERROR`(500). `X-Request-ID` is echoed on every response.

| Method + path | Role | Notes |
|---|---|---|
| `POST /auth/login` | public | email+password → JWT (8 h) |
| `GET /auth/me` | V | |
| `POST /users`, `GET /users` | A | create/list users (needed to create viewers) **(D)** |
| `GET/POST /api-keys`, `DELETE /api-keys/{id}` | A | plaintext returned once on create |
| `POST /jobs` | V | `Idempotency-Key` header; 202 `{job, decision?, defaults_applied}`; replay → 200 |
| `GET /jobs` | V | filters `status, priority, workload_type, from, to`; `limit` 1–200 (default 50), `offset`; returns `{items,total}` |
| `GET /jobs/{id}`, `/events`, `/decisions` | V | headers never returned; only header **names** |
| `POST /jobs/{id}/cancel`, `/run-now`, `/retry` | V (owner) / A | see §3 and F7 |
| `POST /schedule/preview` | V | no writes |
| `POST /schedule/replan` | A | replan-all |
| `GET /schedule/current` | V | current plan summary + per-job windows for the timeline |
| `GET /carbon/current`, `/forecast`, `/generation`, `/history` | V | all include `provider`, `health`, `data_age_minutes` |
| `GET/PUT /settings` | V read / A write | validated ranges, audited, triggers replan |
| `GET /analytics/summary`, `/analytics/export.csv` | V | `from, to, group_by=day\|workload_type\|priority` |
| `GET /audit` | A | **(D)** |
| `GET /system/status` | V | clock, demo flag, provider, health, last plan stats, scheduler heartbeat |
| `GET /demo/state`, `POST /demo/clock`, `/demo/scenarios/{name}`, `/demo/reset`, `/demo/seed`, `/demo/outage` | A | all 404 when `DEMO_MODE=false` |

Settings ranges (derived): `capacity_units` 1–1000; `pue` 1.0–3.0; `max_delay_hours` 0–168; `lambda_*` 0–100; `stickiness_gco2` 0–1000; `stale_after_minutes` 5–720; `fallback_policy` `asap`; `carbon_provider` `neso`\|`mock`.

## 5. Optimization spec (derived §10)

**Slots.** 30-minute UTC slots, `S = 96`, starting at the current slot floor. `d_j = ceil(duration/30)`; the last slot of a job carries a fractional weight when duration is not a multiple of 30. Intensity `I[t]` = actual if published, else forecast.

**Variables.** `x[j,s] ∈ {0,1}`: movable job `j` starts at slot `s`, for `s` in the feasible set `F_j`: `slot_start ≥ earliest_j`, `slot_end ≤ deadline_j` (truncated to horizon), delay ≤ `max_delay_hours`.

**Constraints.** (1) `Σ_s x[j,s] = 1` for every job with non-empty `F_j`. (2) For each slot `t`: `Σ_j units_j · Σ_{s: s ≤ t < s+d_j} x[j,s] ≤ capacity − reserved[t]`, where `reserved` = running jobs + fixed non-deferrable jobs. Jobs with empty `F_j` are flagged `deadline_infeasible` and placed by the ASAP post-pass.

**Objective (minimize).** `cost[j,s] = power_kw_j · pue · 0.5 · Σ_k w_k·I[s+k]  +  λ_prio(j) · delay_hours[j,s] · energy_kwh_j  +  stickiness · 1[s ≠ previous_start_j]`, plus a tie-break epsilon `1e-6 · (job_rank · S + s)` with jobs ranked by id (NFR-12).

**Solve.** `scipy.optimize.milp` (HiGHS, `time_limit=5`, sparse matrices). LP lower bound: `linprog` on the relaxation `0 ≤ x ≤ 1`. `gap = (objective − lp_bound) / max(|lp_bound|, 1e-9)`.

**Fallback chain (FR-16).** MILP raises, is infeasible, or times out with no incumbent → **greedy** (jobs sorted by deadline then priority then id; each placed at its cheapest capacity-feasible window) → **ASAP/EDF** (earliest-deadline-first at the earliest capacity-feasible slot). Every candidate plan passes `validate_plan()` (deadline, capacity, earliest start, delay cap) before acceptance; a failing plan drops to the next fallback.

**Baseline and savings.** `baseline_gco2e` = cost of running at the job's earliest feasible start (ignoring other jobs). `planned_gco2e` = carbon term at the planned start. `saved = baseline − planned` (can be 0; never negative-clamped in storage, but copy states "no saving" for ≤ 0). Realized replaces planned once actual intensity covers the run, labelled *realized*.

**Reason code precedence** (first match wins): `MANUAL_OVERRIDE` → `NON_DEFERRABLE` → `DEADLINE_INFEASIBLE` → `DEGRADED_DATA_FALLBACK` → `CAPACITY_CONSTRAINED` (unconstrained best window was unavailable) → `MAX_DELAY_CAP` (best window lies beyond the cap) → `DEADLINE_CONSTRAINED` (best window lies beyond the deadline) → `CLEANER_WINDOW` (delay > 0) → `RUN_NOW_NO_BETTER_WINDOW`.

**Explanation template fields** (all copied from stored columns, never recomputed): planned start, delay, expected vs baseline average intensity, saved gCO2e and %, slack, data-degraded note. Example format follows PRD J1.

**Staleness ladder (10.7).** `age` = now − newest successful fetch.
- `ok`: age ≤ `stale_after_minutes` (90) and fewer than 3 consecutive failures.
- `degraded`: 3 consecutive failures, or age > 90 min up to 6 h → plan on cached forecast; banner "Using cached forecast, X old".
- `unavailable`: age > 6 h or no data → fail-safe `fallback_policy` (ASAP); every affected decision is `DEGRADED_DATA_FALLBACK`.
Mock provider is always `ok` unless the demo outage toggle is on.

**Triggers (FR-09):** submit, cancel, completion, new forecast, settings change, 15-min heartbeat, replan-all, startup.

## 6. Carbon data shapes (for fixtures)

NESO responses: `{"data":[{"from":"2026-01-15T12:00Z","to":"2026-01-15T12:30Z","intensity":{"forecast":266,"actual":263,"index":"moderate"}}]}`; `/generation`: `{"data":{"from":…,"to":…,"generationmix":[{"fuel":"wind","perc":31.2},…]}}`. Index labels: `very low`, `low`, `moderate`, `high`, `very high`. If the agent has no network, hand-write fixtures from these shapes and name them `*_synthetic.json`; if it has network, record real responses.

Mock curve (gCO2/kWh): overnight wind trough ≈ 80–110, midday solar dip ≈ 130–160, morning ramp and evening peak ≈ 230–270, seeded light noise (±5).

## 7. UI contract (derived §13)

Routes: `/login`, `/` Dashboard, `/jobs`, `/jobs/new`, `/jobs/:id`, `/analytics`, `/settings` (admin), `/system`, `/demo` (only when demo flag on). Global: DEMO chip, data-health banner (provider, age), UTC/local toggle, dark/light theme, role-gated nav.

**Carbon timeline:** custom SVG, 48 h × 30-min cells; five intensity bands, each with colour **and** text label (NFR-08); "now" marker; job bars on deterministic lanes; hover and keyboard focus tooltips; click opens job detail.

Every screen defines loading, empty, error (shows `request_id`) and success states (NFR-07). Estimates are always labelled *forecast-based* or *realized* (F9 AC2). The UI states the zone is Great Britain and that intensity is not renewable availability (§2.5).

## 8. Configuration and operations (derived §14, §17)

Env vars (all in `.env.example`, no secrets committed): `DATABASE_URL`, `DEMO_MODE`, `AUTH_ENABLED`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CARBON_PROVIDER`, `NESO_BASE_URL`, `SIM_SPEED`, `ALLOW_HTTP_TARGETS`, `FORWARD_ALLOWED_HOSTS`, `CORS_ORIGINS`, `RETENTION_DAYS` (90), `LOG_LEVEL`.
Rate limits **(D)**: login 10/min/IP, `POST /jobs` 30/min/principal, other routes 120/min/principal; all configurable.
Forward executor: no redirects followed; 30 s timeout; re-validates target at send time; allowed methods GET/POST/PUT/PATCH/DELETE.
CSV export neutralizes cells starting with `= + - @`.
Retention: only `carbon_observations` older than `RETENTION_DAYS` is pruned; jobs, events and decisions are never pruned in the MVP.

## 9. Permitted dependency additions (beyond PRD §9)

Runtime: `pydantic-settings`, `cryptography`. Dev/test: `openapi-typescript` (generates frontend API types from `/openapi.json`), `vitest-axe` (or `jest-axe`), `pytest-cov`. Any other dependency needs an ADR in `build-progress.md`.
