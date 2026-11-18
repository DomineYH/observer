# Work order @ORDER@ (revision 1) — role: task-verifier — independent review of PR #@PR@ (@TITLE@)

You are the independent reviewer. The host (agent `observer-host`) coordinates. Review PR #@PR@ and report to the host with the command in the last section. Do not change files, commit, push, comment on GitHub or merge.

## Inputs

- PR: `gh pr view @PR@` and `gh pr diff @PR@`.
- Worktree: `@WORKTREE@`, read-only. Start every shell command with `cd @WORKTREE@ && …`. You may run tests there; do not run anything from another checkout.
- Review method: read the two-axis code-review skill at `@REVIEW_SKILL@` and run its two axes as two separate passes yourself, without sub-agents.
  - Standards: `CLAUDE.md` (Code Quality and Testing Policy) and `CODING_STANDARDS.md`.
  - Spec: @SPEC@

## Look hard at these

@FOCUS@

## Output

Write `@REVIEW_FILE@`:

1. Verdict `PASS` or `CHANGES`.
2. Must-fix: a numbered list, each with `file:line` and why (quote the spec or standard).
3. Should-consider: a list; style preferences go here, never in must-fix.
4. What you ran and the result of each command.

## Report

Then run exactly one of these (if it fails, wait 60 s and send it once more):

`herdr agent prompt observer-host "RESULT_SUBMITTED @ORDER@: <PASS|CHANGES>, <n> must-fix, review at @REVIEW_FILE@"`

or, if blocked: `herdr agent prompt observer-host "BLOCKED @ORDER@: <one line>"`
