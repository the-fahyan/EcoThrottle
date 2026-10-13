# build-rule.md — How the AI Agent Must Build GreenShift

*Governs behavior. `implementation-plan.md` says what to build; `build-progress.md` says what is done. Version 1.0, 2026-10-14.*

**Precedence when documents disagree:** `docs/PRD.md` > `prd-addendum.md` > `implementation-plan.md` > `build-progress.md`. The repository's actual state beats `build-progress.md`; correct the progress file, never the reverse.

---

## A. Project Context

**What:** GreenShift is a carbon-aware job scheduling proxy. Clients submit jobs (duration, power, deadline); GreenShift reads GB grid carbon intensity (NESO API, with mock provider and cache fallback), solves a MILP with SciPy, starts each job in the cleanest window that meets its deadline and the cluster capacity, and explains every decision. A React dashboard shows a 48-hour carbon timeline.

**Stack (fixed):** Python 3.12, FastAPI, Pydantic v2, SciPy `milp`/`linprog`, SQLAlchemy 2 + Alembic + SQLite (WAL), APScheduler, httpx, structlog; React 18 + Vite + TypeScript, Tailwind, Radix primitives, TanStack Query, React Router, react-hook-form + zod, Recharts and custom SVG; pytest/Hypothesis/respx, Vitest/Testing Library/Playwright; Docker Compose + nginx.

**Architecture (fixed):** modular monolith in one process; the `jobs` table is the queue; every time read goes through `Clock`; the optimizer is pure (no I/O); explanations are deterministic templates (no LLM); live updates by polling.

**Constraints that shape every decision:**
- Deadlines are never traded for carbon savings. Hard constraints are never violated except by flagging `deadline_infeasible`.
- GreenShift optimizes grid carbon intensity, not renewable availability. Savings are estimates, always labelled *forecast-based* or *realized*.
- No paid services. Must run offline in demo mode.
- All times UTC internally; same inputs give identical plans.

**Governing documents:** `docs/PRD.md` (authoritative 20-section build contract; also mirrored at `GreenShift PRD AI-Driven Smart Energy Load Optimizer.md`), `prd-addendum.md` (architectural derivation & ADR log), `implementation-plan.md`, `build-progress.md`, and `AGENTS.md`. Do not copy PRD text into code comments or reports; cite section IDs instead.

---

## B. Development Rules

**Scope**
1. Implement only the current phase's tasks. Do not pull work forward or add features the PRD does not list.
2. Preserve working behavior. No unrelated refactors, renames or reformatting of files outside the phase.
3. Follow the PRD and addendum. If you believe a decision should change, record it as an issue; do not change it silently.

**Quality**
4. Consistent structure per the repository layout in `implementation-plan.md`; one responsibility per module; type hints everywhere; ruff and mypy clean.
5. Validate every external input with Pydantic (backend) or zod (frontend); handle errors explicitly with the standard error envelope; never swallow exceptions.
6. Real behavior only: no static mock data, hard-coded responses or stub functions standing in for required features. Test doubles live in tests.
7. Keep backend schemas, OpenAPI, generated frontend types and `prd-addendum.md` consistent. If you change a contract, update all four in the same phase.
8. Avoid new dependencies. Allowed: PRD §9 plus `prd-addendum.md` §9. Anything else needs a recorded ADR with justification.

**GreenShift-specific**
9. Never call `datetime.now()` or `time.sleep()` in application code; use `Clock`.
10. `app/scheduling/solver.py`, `model.py`, `greedy.py` perform no I/O and read no clock.
11. Every plan must pass `validate_plan()` before it is saved.
12. Every state change goes through `state_machine.transition()` and writes a `job_events` row.
13. Explanation text is generated from stored fields only, so numbers in text equal stored numbers.
14. A carbon-provider failure must never cause a 500.
15. Planning is serialized by one in-process lock.
16. Demo-only code is gated by `DEMO_MODE`; demo routes return 404 otherwise.

**Security**
17. No secrets in code, tests, fixtures, logs or commits. Configuration comes from environment variables; `.env.example` holds placeholders only.
18. Never log or return stored target header values, passwords, API-key plaintext or JWTs.
19. Forward targets are validated at submission and again at send time; redirects are not followed.

**Testing and honesty**
20. Write or update tests for everything you implement; bug fixes get a regression test.
21. Do not claim something works unless a command you ran shows it. Do not skip, weaken or delete a test to get green.
22. Do not silently skip a requirement. If it cannot be done, record it as `BLOCKED` with the reason.

---

## C. Phase Execution Protocol

### Session start (every session, even mid-phase)
1. Read `AGENTS.md` and `build-progress.md`.
2. Run `git status`, `git log --oneline -10`, `git tag --list 'phase-*'`.
3. Read this file if not already in context.
4. Extract your phase only: `sed -n '/^## Phase N /,/^## Phase N+1 /p' implementation-plan.md`.
5. Read the addendum sections and PRD sections the phase names. Nothing more.
6. Run `make check`. If it fails on untouched HEAD, fix the regression first (see F).

### Per-phase workflow
1. **Identify** the phase, prerequisites, acceptance criteria. Confirm the previous phase is `VERIFIED` and tagged. Phase 0 is the only exception.
2. **Inspect** only the directories the phase touches.
3. **Plan** the task order in `build-progress.md` under *Current phase tasks* (task IDs `P<N>.T<k>`), each `NOT_STARTED`.
4. **Implement** one task at a time, with its tests. After each task: run the focused tests, commit (`phase N: <task>`), mark the task `IMPLEMENTED`, then `VERIFIED` once its tests pass.
5. **Integrate** with existing code through the documented interfaces.
6. **Validate:** run `make check` and each acceptance-criterion test. Record the actual output summary.
7. **Fix** regressions and failures within scope until green.
8. **Document:** update `build-progress.md`; write the handoff report (section E).
9. **Tag** `phase-N-verified` only when every acceptance criterion has evidence.
10. **Stop** at the phase boundary and wait for the next instruction.

Never restart the project, overwrite working files wholesale, or re-implement completed features. If something already exists, extend it.

---

## D. Token and Context Management

- One phase at a time; one task at a time inside it.
- Read targeted: `grep -n`, `sed -n 'a,bp'`, directory listings, and the single function you need. Do not re-read the whole PRD or the whole codebase.
- Prefer `str_replace`-style localized edits over regenerating whole files. Create a file whole only when it is new.
- Keep `build-progress.md` terse: status words, IDs, one-line notes. Do not paste PRD text, code or long logs into it.
- Record decisions future phases must respect as ADRs (one to three lines) in `build-progress.md`.
- Record incomplete work and known issues explicitly the moment you know of them.
- **Checkpoint rule:** commit and update `build-progress.md` after every task. If the session is getting long, or you notice you are losing earlier details, stop starting new tasks: commit, write the exact next action in *Next action*, and tell the user the session can be resumed.
- **Do not rely on conversation memory across sessions.** Everything needed to resume must be in the repository: code, tests, git history and tags, `build-progress.md`.
- Resume from the last `VERIFIED` task or the last phase tag, never from the beginning.
- If a phase proves too large for one session, keep the same phase but continue task by task. Do not split the phase or change its scope without recording an ADR.

---

## E. Phase Completion and Handoff

A phase is **complete** only when: every acceptance criterion has passing test or command evidence, `make check` is green, no earlier test regressed, and `build-progress.md` matches the repository. Generated code alone is not completion.

**Handoff report** (≤ 25 lines; paste in chat and add to the top of *Phase log* in `build-progress.md`):

```
Phase: N — <title>   Status: VERIFIED | PARTIAL | BLOCKED
Requirements implemented: <IDs>
Files created/modified: <grouped paths>
Tests/validation run: <commands>
Results: <pass/fail counts, coverage where required, benchmark numbers>
Acceptance criteria: AC-N.1 ✔ evidence … (list all)
Known failures / unresolved issues: <IDs or none>
Decisions future phases must keep: <ADR IDs or none>
Current project status: <one line>
Next phase: N+1 — <title>
Resume instructions: <exact command or first step>
```

If any criterion lacks evidence, the status is `PARTIAL` and no tag is created.

---

## F. Error Recovery and Continuation

| Situation | Required response |
|---|---|
| Build or test fails | Read the failing output, fix the cause in scope, rerun. Do not disable or weaken the test. After three failed attempts, record an issue with the error summary and what was tried. |
| Integration does not work | Reproduce with the smallest test, check the contract in the addendum or OpenAPI, fix the side that deviates from the contract. |
| External API unavailable (e.g. NESO) | Use the mock provider and fixtures. Never fabricate "recorded" real data; name synthetic fixtures `*_synthetic.json`. Log the limitation. |
| Missing dependency or tool | Install if it is on the allowed list; otherwise ADR first. If the environment cannot provide it, mark `BLOCKED`. |
| Implementation conflicts with the PRD | PRD wins. Fix the implementation. If the PRD itself is contradictory, apply the addendum, otherwise log an issue and choose the option that preserves deadlines and determinism, noting it as an ADR. |
| Interrupted by token or context limits | Follow the checkpoint rule (D). On resume, run session start, verify the last commit builds, continue from *Next action*. |
| Earlier phase is incomplete or regressed | Stop new work. Reproduce the failure, write a regression test, fix it, rerun that phase's acceptance tests, then continue. Log in *Phase log* as a fix against the earlier phase. |
| Cannot resolve a blocker | Mark the task `BLOCKED` with reason and evidence, keep working code committed, and report to the user. Never fabricate passing results or bypass the requirement silently. |

Always preserve working code: commit before risky changes; revert with git, not by deleting files.

---

## G. Project Progress Tracking

`build-progress.md` is the single persistent record (it already exists; do not create an equivalent). The agent is its only writer.

**Status vocabulary (use exactly):** `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTED` (code written, not yet verified) · `VERIFIED` (acceptance evidence exists) · `BLOCKED` (cannot proceed; reason recorded).

**Update it:** after every task, at every blocker, and at each handoff. Contents: overall status, phase table, current phase and task list, verified milestones, test/build status, open issues, ADRs, next action, phase log.

**Consistency check (run at session start and before every handoff):** every `VERIFIED` phase has a git tag; the latest `make check` result and date are recorded; no task is `VERIFIED` without a passing test behind it. If the file contradicts the repository, fix the file and note the correction in the log.

---

## H. Phase Selection and Execution Commands

The user can give plain-language commands. The agent resolves the target phase from `build-progress.md` and git, never from chat history alone.

| Command | Behavior |
|---|---|
| `Start Phase N` | Check phase N−1 is `VERIFIED`. If not, say so and offer to finish or fix it. Then run section C. |
| `Continue to the next incomplete phase` | Pick the lowest-numbered phase not `VERIFIED` whose predecessor is; resume if `IN_PROGRESS`. |
| `Resume from the last verified checkpoint` | Run session start, verify HEAD, continue from *Next action*. |
| `Review and fix the current phase` | Re-run its acceptance tests, fix failures, update records. No new scope. |
| `Audit the application against the PRD` | Read-only: compare the traceability matrix with the repo and tests, write findings to `docs/prd-audit.md`, change no code unless asked. |
| `Run phases N to M` | Allowed only when the user gives the range explicitly; still stop on any failed gate. |
| `Status` | Summarize `build-progress.md` in ≤ 10 lines and verify against git. |

**Antigravity adaptation.** Antigravity reads a root-level `AGENTS.md`/`GEMINI.md` automatically, so `AGENTS.md` points here and holds the start-up ritual. Do not rely on workspace rule files for the full manual (rule files are length-limited). Optional: the user may save the commands above as Antigravity workflows (e.g. `/next-phase`); the process works without them. Use one agent at a time on the build; extra agents may do read-only audits but must not edit `build-progress.md`.
