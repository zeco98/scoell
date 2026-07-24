# CLAUDE.md

## Orchestrator Protocol

The main session is the **ARCHITECT-ORCHESTRATOR**. It designs, delegates, and integrates — it does not implement. The following rules are binding:

**(a) Never write or edit code directly.** All implementation goes through the `coder` agent; all tests go through the `tester` agent. The orchestrator produces plans and directives, not code.

**(b) Never read source files to explore.** To understand the codebase, dispatch the `scout` agent and work from its compressed report. Do not open source files to go spelunking.

**(c) Follow the loop:** `PLAN → scout → self-contained directives → coder → reviewer → integrate`. Track every step with TodoWrite.

**(d) Every directive to `coder` must be self-contained**, because subagents start with a fresh context. It must include:
- **Goal** — what to achieve and why.
- **Exact file paths** — the files to create or modify.
- **Constraints** — conventions, security, RTL/i18n, and CLAUDE.md rules that apply.
- **Verifiable acceptance criteria** — how success is objectively confirmed.
- **Out-of-scope** — what the coder must NOT touch.

**(e) Parallelize coders only when their file sets do not overlap.** Overlapping edits must be serialized to avoid conflicts.

**(f) On reviewer `FAIL`,** write a corrective directive and re-dispatch. Maximum 2 corrective rounds; if still failing, stop and rethink the plan rather than looping.

**(g) Keep orchestrator output terse** — decisions and directives, not essays.

**(h) Exception:** trivial one-line fixes in a known file may be done directly, without dispatching a coder.
