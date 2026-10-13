# AGENTS.md — Antigravity Agent Entry Point for EcoThrottle / GreenShift

*This file is automatically loaded by Google Antigravity. It defines the startup protocol, operating rules, and command mappings.*

---

## 1. Project Context

- **Repository:** `EcoThrottle` (`the-fahyan/EcoThrottle`)
- **Product:** GreenShift — An intelligent, carbon-aware job scheduling proxy.
- **Mission:** Minimize grid carbon emissions of time-flexible compute workloads (SDG 13) by shifting execution to optimal carbon intensity windows without violating SLAs.
- **Core Stack:** Python 3.12, FastAPI, SciPy (`milp`, `linprog`), SQLAlchemy 2.0, SQLite (WAL), React 18, Vite, TypeScript, Tailwind CSS.

---

## 2. Governing Documentation Authority Order

When documents appear to differ, follow this strict precedence:
1. `docs/PRD.md` (v1.1, full 20 sections; mirrored at root PRD) — The build and UI contract.
2. `prd-addendum.md` — Architectural derivations and permanent ADR log.
3. `implementation-plan.md` — Phased 18-milestone implementation roadmap.
4. `build-progress.md` — Persistent progress and verified milestone tracker (Agent is sole writer).
5. `build-rule.md` — Operating behavioral manual for build agents.

---

## 3. Session Startup Ritual (Mandatory Every Session)

Every agent invocation or resumption must execute this protocol before writing code:

1. **Check State:** Read `build-progress.md` to identify the active phase, current task, and open issues.
2. **Inspect Git:** Run:
   ```bash
   git status
   git log --oneline -10
   git tag --list "phase-*"
   ```
3. **Load Rules:** Verify `build-rule.md` constraints are active in context.
4. **Extract Target Phase:** Extract only the current phase from `implementation-plan.md`:
   ```bash
   # Example for Phase N:
   sed -n '/^## Phase N /,/^## Phase N+1 /p' implementation-plan.md
   ```
5. **Targeted Reading:** Read only the specific PRD sections cited in that phase's `PRD refs`.
6. **Verify Baseline:** Run `make check`. If any baseline failure exists on untouched HEAD, fix the regression before starting new tasks.

---

## 4. Supported Plain-Language Commands

When the user gives these instructions, execute the corresponding workflow:

| User Command | Agent Behavior |
|---|---|
| `Start Phase N` | Check Phase $N-1$ is `VERIFIED`. If yes, begin task-by-task execution per `build-rule.md`. |
| `Continue to next incomplete phase` | Identify lowest-numbered phase not `VERIFIED` whose predecessor is `VERIFIED`; resume work. |
| `Resume from last verified checkpoint` | Run startup ritual, verify HEAD, continue from *Next action* in `build-progress.md`. |
| `Review and fix current phase` | Re-run acceptance tests for active phase, fix failures within scope, update records. |
| `Audit application against PRD` | Read-only check comparing codebase and tests against `docs/PRD.md` traceability matrix. |
| `Status` | Summarize `build-progress.md` in $\le 10$ lines and verify against git. |

---

## 5. Non-Negotiable Engineering Rules

1. **One Task at a Time:** Implement one task, write focused tests, verify, commit, and mark `VERIFIED` in `build-progress.md`.
2. **Never Call System Clock Directly:** Always use the `Clock` abstraction (`app/core/clock.py`), never `datetime.now()` or `time.sleep()`.
3. **Pure Solvers:** `app/scheduling/solver.py`, `model.py`, and `greedy.py` must contain zero I/O and zero clock reads.
4. **Validation Guard:** Every plan must pass `validate_plan()` before saving to SQLite.
5. **Atomic State Transitions:** Every state change goes through `state_machine.transition()` and writes a `job_events` row.
6. **No Phantom Code:** No static mock data, stub functions, or fake passes standing in for required functionality.
7. **Security First:** Reject unsafe forward targets (SSRF protection), encrypt forward headers at rest via Fernet, and keep secrets in `.env`.
