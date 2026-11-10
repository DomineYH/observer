# Herdr operating guide

How the host (the coordinator session) runs workers in Herdr panes for this repo. The routing rules themselves are in the Task routing block of `CLAUDE.md` and in `.routing/ROUTING_POLICY.md`; this guide is the practical side. Paths below use `~/wt/observer` for the worker area; `OBSERVER_WT` overrides it and `OBSERVER_ROOT` overrides the repository root the tools work on.

## 1. Names and reports

- The host pane's agent is named `observer-host` (`herdr agent rename <pane> observer-host`).
- Every order ends with one report line, `herdr agent prompt observer-host "RESULT_SUBMITTED <order_id>: ..."` (or `NEEDS_DECISION` / `BLOCKED`). It arrives in the host as a user turn.
- While an AskUserQuestion dialog is open in the host pane, a worker's `herdr agent prompt observer-host ...` fails and the report is lost. Orders tell workers to retry once after 60 s; after answering a dialog, the host checks idle worker panes for unsent RESULT lines.

## 2. Layout

- Worktrees live on ext4 at `~/wt/observer/<task>` (fast npm). Orders, plans, reports, reviews and question files go in `~/wt/observer/_notes/` (orders in `_notes/orders/<order_id>.md`). Both are removed after the PR merges.
- Host tools, all with `--self-test`:
  - `tools/host/dispatch.py` — start a worker on an issued order and confirm it is working.
  - `tools/host/watch.py` — wait in the background until a worker changes state or shows a prompt.
  - `tools/host/record.py` — write and check task records in `.routing/tasks/`.
  - `tools/host/jev.py` — call Jev and apply the decision rules.
  - `tools/host/templates/research-order.md` — the researcher order template.

## 3. Orders

- Write each order with the file-write tool, never with a shell heredoc: a quoting error once meant an order was never sent.
- The first line is `# Work order <order_id> (revision <n>) — role: <role> — ...`, and the last section ends with the one-line report command for that order id. `dispatch.py` refuses anything else.
- Researcher orders start from `tools/host/templates/research-order.md`; fill every `@NAME@` placeholder (dispatch refuses leftovers).
- An order never tells a worker to ignore a failing check. If a check is known to fail, fix it or stop and decide.

## 4. Dispatch

- Register the order in the task record first (`record.py put`, with `role_work_items.<order_id>.role_id`), then:
  `python3 tools/host/dispatch.py <task_id> <order_id> --name <agent> --split <pane>` (or `--pane <id>` for an existing shell pane, for example a new tab made with `herdr tab create`). `--dry-run` prints the herdr commands without running them.
- The role, harness, model and effort come from the record and `python3 .routing/resolve_models.py --role <id>`, never from memory or a flag.
- Exit codes: 0 `DISPATCHED` (the only case in which a worker counts as started), 2 `REFUSED`, 3 `MANUAL` (fix by hand, then rerun with `--no-start`), 4 `NOT_WORKING`.
- codex startup dialogs. dispatch identifies each by its own text and answers it, even when `agent start` reports ready:
  - `Trust this folder` (first start in a folder) → `enter`;
  - codex v0.167's hooks screen, `⚠ <n> hooks need review before they can run.` together with `esc close`, `t trust all` or `Lifecycle hooks` → `esc` (continues without trusting);
  - the older numbered `Hooks need review` menu, recognised by its `Continue without trusting` option → `down down enter`.

  Any other screen with `hooks need review` (for example the new screen cut off before its footer) stops with exit 3 `MANUAL unknown hooks screen` and no keys sent. This takes precedence over every other match, so `trust this folder` text on the same screen does not get `enter`. A dialog still on screen after three rounds is exit 3 as well.
- dispatch sends the order only to an agent whose status is exactly `idle` or `done` and that is `interactive_ready`; any other status (`working`, `blocked`, `unknown`, missing) is exit 3 `MANUAL agent busy or unknown`. It counts the worker as started only when all of these hold: `herdr agent prompt` exits 0; the agent then reads `working` and still `working` on a second read at least 3 s later (a change caused by the send, since it was not working before); and the visible screen afterwards shows no startup dialog. Anything else is exit 4. A dialog can swallow the prompt and still let the agent read as working.
- A screen that cannot be read (`herdr pane read` fails) never counts as a clear screen: exit 3 `MANUAL screen unreadable` before the send, exit 4 `status=screen-unreadable` while confirming.
- A prompt sent right after a start can sit unsubmitted in the input box while the agent reads as idle. dispatch sends `enter` once if the agent is not `working` within 15 s. Whenever you prompt by hand, check `working` a few seconds later.
- opencode has no model flag. dispatch starts it with `--auto` and exits 3. Then prompt `/model`, `herdr pane send-text <pane> "<model display name>"`, send `enter`, check that the footer shows the model and effort from `resolve_models.py`, and rerun with `--no-start`.
- A second order to the same pane (planner, then implementer) uses `--no-start`.

## 5. Waiting and reading panes

- After a dispatch, run `python3 tools/host/watch.py <agent> [<agent> ...]` with the Bash tool's `run_in_background`. It returns on a status change, a visible permission prompt, a vanished agent, or after the heartbeat interval (600 s) with `silent`. Two silent returns in a row for the same order mean BLOCKED (ORDER-8). Do not use `herdr agent wait --until working` or `agent prompt --wait` for this: they can return at once on stale state.
- Grey text in a Claude Code input box is a prompt suggestion, not typed input.
- The host cannot scroll a worker pane. Orders tell workers to also write each round of questions as a table to `~/wt/observer/_notes/<task>-questions.md`.
- A claude worker that stops on "API Error: Connection lost mid-response": check for partial GitHub writes, then tell it to continue.

## 6. Researchers (agy)

- agy asks permission for every shell command and file write, and a pending prompt reads as `idle`, not `blocked`.
- One tab per researcher (a small pane cuts off the command being approved). Agent `res-<n>`, order `research-<n>-o<k>`.
- The host approves each prompt by hand. Approve only when all of these hold; when unsure, decline and ask the researcher:
  - the command is read-only;
  - it has no `$`, backticks or redirection (`>`, `>>`, `<`);
  - it reads and writes only inside `/tmp/research-<n>/`, the researcher's order file or the repository (not `.git/` or `.routing/tasks/`);
  - no option takes a `@file` value (for example `curl -d @file`);
  - a script is read in full before it is approved.
- `watch.py` returns as `prompt` when a researcher's screen shows a permission prompt, so the host notices it.
- Automatic approval waits for the researcher sandbox in issue #89.
- Researchers put multi-line code in `/tmp/research-<n>/*.py`; folded commands are declined. Inputs from elsewhere are copied into `/tmp/research-<n>/` by the host.
- Before reading a research report, check that its claims table is complete (every claim has a row; facts quote a primary source; computed numbers name a script and an independent library cross-check or say it was not run). Return incomplete reports.

## 7. Reviewers (codex)

- A codex reviewer runs both review axes as separate passes, without sub-agents.
- The order names the path of the review skill file to read; look it up when issuing the order.

## 8. Parallel worktrees

- Playwright's webServer uses ports 4173/4174 with `reuseExistingServer`, so a run can test another worktree's server. Orders tell workers to check the ports are free first.

## 9. Screenshots

- Screenshots meant for the host are captured at, or scaled to, at most 1000 px wide.

## 10. Records and Jev

- Jev request and response files go to `.routing/tasks/jev/<task_id>.request.json` and `<task_id>.jev.json` (`.jev.r<n>.json` for later revisions); records are `.routing/tasks/<task_id>.json`. All of `.routing/tasks/` except `.gitkeep` is local.
- `python3 tools/host/jev.py .routing/tasks/jev/<task_id>.request.json .routing/tasks/jev/<task_id>.jev.json`, then `python3 tools/host/record.py put <task_id> fields.json --jev .routing/tasks/jev/<task_id>.jev.json`.
- Never edit a record by hand. record.py refuses an invalid record and keeps the previous version as `<task_id>.json.bak`.
- `python3 .routing/verify_routing.py` must stay PASS.

## 11. Decisions

- Who decided what lives in one table: the Notes of the task's wayfinder map, columns decision / `user` or `delegated` / quoted source.
- Orders link that table and never restate who decided.
