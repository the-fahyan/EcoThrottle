# prd-addendum.md — Architectural Derivations and Harmonization Log

*Created 2026-10-14 · Updated 2026-10-14 · Status: **CONSOLIDATED & RECONCILED WITH PRD v1.1***

## 0. Historical Context and Consolidation

Initially, the draft PRD file (`GreenShift PRD AI-Driven Smart Energy Load Optimizer.md`) contained sections 1 through 9, but omitted sections 10 through 20. This addendum was initially drafted to reconstruct the missing build and UI contracts (§10 Scheduling, §11 Database, §12 API, §13 UI/UX, §14 Security/Reliability, §15 Testing, §16 Delivery, §17 Deployment, §18 Risks, §19 Glossary, §20 Checklist).

**As of PRD v1.1 (14 October 2026):**
Sections 10 through 20 have been fully drafted, reconciled, and formally incorporated into both `docs/PRD.md` and `GreenShift PRD AI-Driven Smart Energy Load Optimizer.md`. 

**Authority Order:**
1. `docs/PRD.md` (v1.1, complete 20 sections) = Primary authoritative build contract.
2. `prd-addendum.md` = Historical derivation log, architectural clarifications, and decision rationale (ADRs).
3. `implementation-plan.md` = Phased implementation roadmap.
4. `build-progress.md` = Persistent progress and verified milestone log.

All derivations marked **(D)** in the original addendum are now formal, ratified specifications within PRD v1.1.

---

## 1. Resolved Ambiguities and Architectural Decisions (ADR Log)

| # | Ambiguity / Tension | Documented Resolution in PRD v1.1 | Permanent ADR ID |
|---|---|---|---|
| **R1** | F11 demo clock speed contradiction: §1 claims "a full day in 5 min" (288x), but F11 sets default 120x. | Default is `SIM_SPEED=120` (1 real min = 2 sim hours). Configurable 1x to 3600x. UI includes a dedicated 288x preset button labeled *"One day in 5 min"*. | ADR-001 |
| **R2** | Setting `lambda_*` units stated as "gCO2/kWh per hour", while carbon cost is in gCO2e. | Objective formulation is dimensionally homogeneous: $\text{Delay Penalty (gCO2e)} = \lambda_{\text{priority}} \times \text{delay\_hours} \times \text{job\_energy\_kwh}$. | ADR-002 |
| **R3** | Non-deferrable jobs (`deferrable=false`) ignore deadlines but require cluster capacity. | Deterministic pre-pass allocates non-deferrable jobs to the earliest capacity-feasible slot from `earliest_start_at` (`now`), reserving slots prior to running the MILP. Reason: `NON_DEFERRABLE`. | ADR-003 |
| **R4** | §8.2 debounces planning by 2s, but F1 requires returning decisions within 3s. | Leading-edge debounce with coalescing: initial submission triggers immediate solve; burst follow-ups coalesce over 2s. Ingestion endpoint waits up to 3s for job decision. | ADR-004 |
| **R5** | F10 states Viewers manage "their own jobs", but ownership linkage was underspecified. | `jobs.created_by_user_id` tracks submitter. API keys belong to a `user_id` and inherit permissions. Viewers can cancel/retry only jobs they created; Admins can act on any job. | ADR-005 |
| **R6** | F5 AC3 states interrupted forward jobs are "marked failed and retried" on server restart. | On startup `reconcile()`: `running` forward jobs transition `running -> failed` (event: `INTERRUPTED`), followed by `failed -> retry_wait` if `attempts < 3`. | ADR-006 |
| **R7** | `carbon_provider` setting vs `DEMO_MODE` flag. | `DEMO_MODE=true` initializes active provider to `mock`. Admin can dynamically switch to `neso` in demo mode to showcase live-data handling. | ADR-007 |
| **R8** | 48-hour forecast horizon vs 7-day allowed deadline. | Optimization variable window is strictly bounded to the 48-hour forecast horizon ($S=96$). Deadlines $> 48\text{h}$ are capped at horizon boundary and re-planned dynamically as time rolls forward. | ADR-008 |
| **R9** | NFR-05 mandates header encryption at rest; library was unspecified in §9. | Formally adopted `cryptography.fernet.Fernet` with key from `ENCRYPTION_KEY`, plus `pydantic-settings` for settings management. | ADR-009 |
| **R10**| `/healthz` and `/readyz` semantics. | `/healthz`: returns 200 if process alive. `/readyz`: returns 503 only if SQLite DB or scheduler heartbeat fails. Provider in `degraded` returns 200 with `status: "degraded"`. | ADR-010 |
| **R11**| Counterfactual baseline calculation. | Counterfactual baseline is calculated as if the workload started at `earliest_start_at` independently of other jobs, representing emissions without GreenShift intervention. | ADR-011 |
| **R12**| Deterministic tie-breaking for solver consistency. | $\epsilon_{j, s} = 10^{-6} \times (\text{rank}(j) \times S + s)$ with jobs ordered by UUID, guaranteeing byte-identical plans across repeated runs (NFR-12). | ADR-012 |

---

## 2. Harmonized Data Model Summary (PRD §11)

All timestamps are stored as ISO-8601 UTC strings with `Z`. IDs are UUID strings (deterministic `uuid5` in demo scenarios). Enums are validated via Pydantic and enforced by database `CHECK` constraints.

- `users`: `id`, `email`, `password_hash` (Argon2id), `role` (`admin`|`viewer`), `is_active`, `created_at`.
- `api_keys`: `id`, `user_id`, `name`, `key_prefix` (`gs_...`), `key_hash` (SHA-256), `role`, `created_at`, `last_used_at`, `revoked_at`.
- `jobs`: `id`, `name`, `description`, `workload_type`, `priority`, `deferrable`, `duration_minutes`, `resource_units`, `power_kw`, `power_kw_source`, `pue_used`, `energy_kwh`, `earliest_start_at`, `deadline_at`, `execution_mode` (`simulated`|`forward`), `target_url`, `target_method`, `target_headers_enc`, `target_body`, `status`, `planned_start_at`, `planned_end_at`, `started_at`, `finished_at`, `attempts`, `last_error`, `deadline_infeasible`, `baseline_gco2e`, `planned_gco2e`, `realized_gco2e`, `created_by_user_id`, `created_via`, `api_key_id`, `idempotency_key`, `version`, `created_at`, `updated_at`.
- `job_events`: `id`, `job_id`, `ts`, `from_status`, `to_status`, `event_type`, `actor`, `reason_code`, `detail_json`.
- `job_runs`: `id`, `job_id`, `attempt`, `started_at`, `finished_at`, `outcome` (`running`|`succeeded`|`failed`), `http_status`, `error`, `avg_actual_intensity`, `realized_gco2e`.
- `schedule_plans`: `id`, `created_at`, `trigger`, `solver` (`milp`|`greedy`|`asap`), `solver_status`, `objective`, `lp_bound`, `gap`, `n_jobs`, `n_vars`, `duration_ms`, `data_health`, `data_age_minutes`, `horizon_start`, `horizon_end`, `is_current`, `settings_snapshot_json`.
- `scheduling_decisions`: `id`, `plan_id`, `job_id`, `is_current`, `planned_start_at`, `delay_minutes`, `reason_code`, `explanation`, `expected_avg_intensity`, `baseline_avg_intensity`, `baseline_gco2e`, `planned_gco2e`, `saved_gco2e`, `slack_minutes`, `data_degraded`, `created_at`.
- `carbon_observations`: `id`, `provider`, `period_start`, `period_end`, `forecast_gco2_kwh`, `actual_gco2_kwh`, `index_label`, `interpolated`, `fetched_at`, `source` (`live`|`cache`|`mock`); **unique(provider, period_start)**.
- `generation_mix_snapshots`: `id`, `provider`, `fetched_at`, `mix_json`, `renewable_share_pct`.
- `settings`: `key` (PK), `value_json`, `updated_by`, `updated_at`.
- `audit_log`: `id`, `ts`, `actor`, `action`, `target`, `before_json`, `after_json`.

Indexes:
- `jobs(status, planned_start_at)`
- `jobs(created_by_user_id)`
- `job_events(job_id, ts)`
- `scheduling_decisions(job_id, is_current)`
- `carbon_observations(provider, period_start)`

---

## 3. Harmonized Job State Machine (PRD §11.4)

| Current Status | Allowed Next Status | Trigger / Actor | Invariant / Side Effect |
| --- | --- | --- | --- |
| `(initial)` | `pending_plan` | Client submit | Persist job and write `submitted` event. |
| `pending_plan` | `scheduled` | Planner | Decision saved; write `scheduled` event. |
| `pending_plan`, `scheduled`, `retry_wait` | `cancelled` | User (Owner) / Admin | Write `cancelled` event. Terminal state. |
| `scheduled` | `running` | Dispatcher CAS / Run-Now | CAS query matches `version`; write `started` event. |
| `running` | `succeeded` | Executor | Compute realized gCO2e; write `succeeded` event. Terminal state. |
| `running` | `retry_wait` | Forward Executor | HTTP failure with attempts < 3. Delay: 30s, 2m, 10m. |
| `running` | `failed` | Forward Executor | Retries exhausted (3) or crash interruption. |
| `retry_wait` | `running` | Dispatcher | Backoff delay elapsed; write `started` event. |
| `failed` | `retry_wait` | System Startup | Interrupted recovery with attempts remaining. |
| `failed` | `pending_plan` | User (Owner) / Admin | Manual retry action; resets `attempts = 0`. |

---

## 4. Harmonized API Error Contract (PRD §12.2)

Standard Error Envelope (returned on all 4xx/5xx responses):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary message",
    "details": [
      {
        "field": "deadline_at",
        "message": "deadline_at must be at least duration_minutes after earliest_start_at"
      }
    ],
    "request_id": "req_uuid_string"
  }
}
```

Registered Error Codes:
- `VALIDATION_ERROR` (422)
- `TARGET_NOT_ALLOWED` (422)
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `ILLEGAL_TRANSITION` (409)
- `NO_CAPACITY` (409, includes `next_feasible_at`)
- `RATE_LIMITED` (429)
- `INTERNAL_ERROR` (500)

---

## 5. Optimization & Fallback Chain Summary (PRD §10)

1. **MILP Solver:** HiGHS branch-and-cut via `scipy.optimize.milp` (5.0s time limit).
2. **Greedy Fallback:** Ordered by `deadline_at ASC`, `priority DESC`, `created_at ASC`, `id ASC`. Placed at lowest-carbon feasible window.
3. **ASAP Fallback:** Earliest-Deadline-First at earliest capacity-feasible slot.
4. **Validation Guard:** Every plan must pass `validate_plan()` before saving.

**Precedence of Reason Codes:**
`MANUAL_OVERRIDE` → `NON_DEFERRABLE` → `DEADLINE_INFEASIBLE` → `DEGRADED_DATA_FALLBACK` → `CAPACITY_CONSTRAINED` → `MAX_DELAY_CAP` → `DEADLINE_CONSTRAINED` → `CLEANER_WINDOW` → `RUN_NOW_NO_BETTER_WINDOW`.

**Grid Staleness Ladder:**
- `ok`: age $\le 90$m and consecutive failures $< 3$.
- `degraded`: 90m $<$ age $\le 6$h or failures $\ge 3$. Plan on cached forecast.
- `unavailable`: age $> 6$h. Fail-safe ASAP policy; all decisions tagged `DEGRADED_DATA_FALLBACK`.

---

## 6. Approved Additional Runtime Dependencies

Beyond the initial core stack, the following libraries are formally approved and incorporated into PRD §9:
- `pydantic-settings`: Type-safe application settings via environment variables.
- `cryptography`: Fernet encryption for forward proxy headers at rest.
- `openapi-typescript`: Build-time generation of TypeScript contracts from FastAPI OpenAPI schema.
- `vitest-axe` / `axe-core`: Automated accessibility auditing.
- `pytest-cov`: Strict backend test coverage measurement.
