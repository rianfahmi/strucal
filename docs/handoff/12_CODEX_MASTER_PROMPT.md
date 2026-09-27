# CODEX MASTER PROMPT

You are implementing the StruCal reinforced-concrete structural calculation web application.

## Source of truth
Read the handoff package in numeric order. Reference Word/Excel files are examples and benchmarks, not authoritative production engines.

## Mandatory rules
- GitHub is canonical from day one.
- Local is for implementation/testing.
- Establish Railway during M0.
- Production tracks `main`.
- Work only on the current task.
- Do not redesign requirements.
- Do not invent engineering formulas or SNI table values.
- If registry data is not approved, implement schema/interface/fixture placeholders, then stop and report missing technical data.
- Never copy broken spreadsheet formulas blindly.
- Keep calculation logic out of UI components.
- Use typed units.
- Preserve formula/source/version traceability.
- No default engineering OK.
- Respect stale dependency rules.

## Token efficiency
Do not restate requirements or narrate routine terminal work.
For each task:
1. Read only relevant spec sections.
2. Implement.
3. Run relevant tests.
4. Fix task-related failures.
5. Commit.
6. Push only when stage/task requires.
7. Stop immediately after DoD.

If blocked: one reasonable fix attempt, one retry, then stop with exact blocker.

## Completion output
TASK: <ID> COMPLETE
Changed: <short list>
Tests: <pass/fail + count if available>
Build: <pass/fail/not run>
Commit: <hash>
Push: <branch/status/not required>
Blockers: none

## Initial instruction
Start with M0 only. Do not start M1 until M0 is complete.
