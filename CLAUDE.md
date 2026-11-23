# Project agent guide

## 0. Source of truth
- Domain language and decisions: `GLOSSARY.md` and `docs/adr/`. How to read and use them: `docs/agents/domain.md`.
- Specs and tickets: GitHub Issues (`/to-spec` publishes the spec issue, `/to-tickets` the ticket issues). A ticket links its spec.
- Agent reports: `.agent-reports/<task>/` in the main checkout, always given as an absolute path. Never committed.

## 1. Who does what
- Planning only: Matt Pocock skills (`/grill-with-docs`, `/domain-modeling`, `/to-spec`, `/to-tickets`, `/wayfinder`, `/triage`, `/handoff`).
  During implementation use no Matt skill except `domain-modeling`. Never use `/implement` or `/implement-spec`.
- Implementation only: `/pstack:poteto-mode` with the Feature, Bug fix, Refactoring, Perf or Investigation playbook.
  Write the code yourself: no subagents, `interrogate`, `arena`, Multi-phase plan, Opening a PR, Shipping or Autopilot.
  Verify with unit and integration tests, commit, write the report, stop. Do not push.
- Review: the Codex (GPT) reviewer pane only. Never `/codex:review`, Matt `code-review` or pstack `interrogate`.
- Browser and E2E testing: the agy (Gemini) tester pane only.
- External facts (official docs, third-party APIs, specs, outside source code): the agy (Gemini) researcher pane only.
  This replaces the background agent of `/research` and of `wayfinder:research` tickets.
  A worker that needs an external fact writes the question in its report and stops.
- In-repo exploration is not research: use the poteto-mode Investigation playbook.
  Read-only fact lookups during planning may stay in the session.

## 2. Before implementing
1. Read the ticket and the spec issue it links to. The spec's acceptance criteria are the definition of done.
2. Do not implement tickets labelled `needs-triage`, `needs-info` or `ready-for-human`. Report that and stop.

## 3. While implementing
- A concept missing from the glossary, or a term used in two senses: add or fix the `GLOSSARY.md` entry in the same branch.
- A decision that is hard to reverse, surprising, or a real trade-off: add `docs/adr/NNNN-slug.md` in the same branch.
- List glossary and ADR changes under "Domain changes" in the report.

## 4. Sessions
- The session the user starts with `/coordinator` is the Herdr coordinator and follows `docs/agents/herdr_orchestrator.md`.
- Every other session is a worker. A worker produces only its assigned deliverable and its report file,
  and starts no worker or subagent.

## Agent skills

### Issue tracker
Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels
Five labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Rules
You are a wise coordinator and orchestrator.
You must write code while using workers.
Use Herdr to configure panes and assign tasks to workers; the operating guide is `docs/agents/herdr_orchestrator.md`.
Workers run in TUI harnesses in Herdr panes (claude, codex, agy, opencode).
Since the workers aren’t as smart as you are, you must give them clear and detailed instructions.
Workers should report to the coordinator once the work is completed.

Since workers are very slow, they may fail to submit reports after they terminate. When assigning work to a worker, ensure that it can submit reports; waiting and liveness checks follow "Waiting and uncertain states" in `docs/agents/herdr_orchestrator.md`.

## Code Quality

- Prefer cohesive modules with clear responsibilities and simple dependencies.
- Treat 300 lines as a review signal, not a hard file limit.
- Split files only when there is a clear responsibility, dependency or testing boundary.
- Keep feature changes, bug fixes, and structural refactoring separate whenever practical.
- Generated code, migrations, schemas, fixtures, snapshots, and configuration files are exempt from file-size guidance.

## Testing Policy

- During implementation, prefer targeted tests for the current change.
- After implementation, run affected tests and relevant integration tests based on the actual change impact.
- Do not run the full test suite repeatedly during development.
- Run the full suite locally only for broad or high-risk changes, or when the affected scope cannot be determined reliably. Otherwise, full regression testing belongs to CI.
- Never reduce test scope when shared APIs, schemas, database models, configuration, or widely used components are changed without first evaluating their impact.


