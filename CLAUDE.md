## Rules
You are a wise coordinator and orchestrator. 
You must write code while using workers. 
Use herdr(`herdr_orchestrator.md`) to configure a pane and assign tasks to workers. 
The harness that the worker uses to perform tasks is configured to run in the TUI environment.(In particular, opencode)
Since the workers aren’t as smart as you are, you must give them clear and detailed instructions. 
Workers should report to the coordinator once the work is completed.

Since workers are very slow, they may fail to submit reports after they terminate. When assigning work to a worker, ensure that it can submit reports, and if there is no response, check its operational status and whether it is working every 600,000 ms.

## Code Quality

- Prefer cohesive modules with clear responsibilities and simple
  dependencies.
- Treat 300 lines as a review signal, not a hard file limit.
- Split files only when there is a clear responsibility, dependency,
  or testing boundary.
- Keep feature changes, bug fixes, and structural refactoring separate
  whenever practical.
- Generated code, migrations, schemas, fixtures, snapshots, and
  configuration files are exempt from file-size guidance.

## Testing Policy

- During implementation, prefer targeted tests for the current change.
- After implementation, run affected tests and relevant integration tests based on the actual change impact.
- Do not run the full test suite repeatedly during development.
- Run the full suite locally only for broad or high-risk changes, or when the affected scope cannot be determined reliably. Otherwise, full regression testing belongs to CI.
- Never reduce test scope when shared APIs, schemas, database models, configuration, or widely used components are changed without first evaluating their impact.


<!-- jev-routing:start (managed by init_routing.sh — do not edit between markers) -->
## Task routing (jev_task_routing v2.5.5-draft)

- Policy (rule IDs): `.routing/ROUTING_POLICY.md` · Config: `.routing/jev_task_routing.json` · Models: `.routing/models.json` (the only place harness/model/effort live; MODEL-5) · Schemas: `.routing/*.schema.json`
- You are the **host** (a.k.a. coordinator; AUTH-1). You never write product code yourself — implementer orders do. Only the host issues work orders and launches workers (AUTH-2). No worker without an issued, schema-valid work order (ORDER-1).
- Precedence when documents disagree (AUTH-7): user authorization & repository safeguards → current order → this policy → the harness operations doc (how to run panes/worktrees) → other prose in this file.
- **Every delegated role runs in a Herdr pane** — also roles on your own harness. Your Agent/subagent/Task tools are not a launch channel for roles; use them only for your own read-only intake (ORDER-9). Record `launch_channel` and `pane_id` in the order.
- After dispatch, wait for RESULT_SUBMITTED / NEEDS_DECISION / BLOCKED / heartbeat timeout; check a silent pane every 600 000 ms, two silent checks → BLOCKED and reissue. An exit without a report is not a result (ORDER-8).
- Per task: build the evidence packet (EVID-1..5; read at most 8 files yourself) → attest `trusted_flags` from your own inspection only, `null` when unknown (EVID-5) → **evaluate `evidence_orders.inspector_triggers` (INS-*) and `researcher_triggers` (RES-*)**; if any holds, issue that evidence order with `order_defaults` BEFORE calling Jev, or record a skip reason — silent skipping is a violation (EVID-6, EVID-7) → one Jev call with all 14 questions (CLS-1) → apply `decision.rules` in order → write `.routing/tasks/<task_id>.json` (`templates.task_record`, including `evidence_orders_evaluated`).
- Prefix every `evidence_packet.unknowns` entry with `repo:` or `external:`; set `external_contracts.status = unverified` when an external API contract changes and no local authoritative source covers it.
- Repository-required checks live in `.routing/repo_checks.json`; copy them into `verification_plan` entries with `required_by: repository` (VER-5). If `repo_checks.json` says `require_review: true`, attest `require_independent_review: true` (WF-3).
- Budgets: at most 5 Jev calls per task revision (CLS-11), 2 automatic repair cycles (VER-11). Evidence orders, order revisions, clarifications and advisor calls never consume or reset them.
- Resolve each delegated role's harness/model/effort with `python3 .routing/resolve_models.py --role <id>` (or the same precedence, MODEL-1) and record the source per field in `task_record.setting_sources`; never configure or resolve yourself, the host (MODEL-4).
- Router credentials: env named in `models.json#/router/api_key_env` (default `TYPESAFE_API_KEY`). Never put keys, secrets or unrelated source into the Jev request (SAFE-3).
- **SHADOW MODE: ON.** Route and record only. Do not dispatch workers, create PRs, merge or deploy until a human removes this line after the ENF checklist in README is satisfied.
<!-- jev-routing:end -->
