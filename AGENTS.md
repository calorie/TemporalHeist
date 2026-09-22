# Agent contract

This repository uses a minimal, cost-aware engineering policy.

The user should normally provide only the engineering objective. Automatically optimize execution using the runtime's native capabilities.

## Automatic optimization

For every substantive task, first plan review topology for the full objective, then automatically decide:

1. the review dependency graph and PR topology for the full objective;
2. the minimum useful reasoning/effort level;
3. what should remain in the primary context;
4. what should be delegated to fresh subagents;
5. what independent work should run in parallel;
6. whether isolated worktrees/checkouts are required;
7. whether durable task state is required;
8. what verification evidence is sufficient.

Do not ask the user to make orchestration decisions unless a real product, authorization, or irreversible-action decision requires input.

## Review dependency graph

Immediately after receiving a substantive objective, before broad implementation begins, derive the review dependency graph for the **full objective**.

Partition the objective into the smallest useful units that are independently reviewable and independently verifiable.

Choose review topology before implementation:

- one focused reviewable unit -> one PR;
- multiple independent reviewable units -> independent PRs;
- multiple dependent, independently reviewable and independently verifiable units -> GitHub Stacked PRs.

When the objective already defines dependent milestones or phases, treat that as strong evidence for a stack unless those milestones cannot produce meaningful intermediate review states.

If stack conditions are met, initialize the stack before implementing dependent upper layers.

Once a lower layer's contract is stable and locally verified, continue the dependent upper layer on top of it without waiting for the lower PR to merge.

Do not turn a dependent milestone sequence into a series of PRs all based on the default branch merely because the milestones are implemented one at a time.

Do not create stacks merely to increase PR count. Each layer must reduce review risk, unblock later work, or remove merge-wait time from the critical path.

Preserve the selected topology during execution unless scope or dependencies materially change.

## Effort

Start ordinary work at the runtime/model default.

Escalate only when the task is meaningfully long-running, codebase-wide, strongly parallelizable, difficult to verify manually, or expensive to get wrong.

- Claude Code: proactively use Dynamic Workflows for high-leverage work when available and beneficial. Do not require ultracode for every session.
- Codex: keep multi-agent capability available and proactively delegate when fresh context, parallel investigation, isolated implementation, or independent verification materially improves throughput or result quality. Do not require Ultra reasoning for every task.

## Context

Protect the primary context proactively.

Delegate noisy or self-contained work when the primary thread needs the conclusion rather than the full process. Typical candidates include repository exploration, broad search, logs, test-output analysis, independent review, and isolated implementation units.

Return compact findings and decisions instead of raw intermediate output.

Rely on runtime-native compaction and workflow state. Never ask the user to manage context cleanup, `/clear`, or `/compact`.

## Parallelism

Automatically parallelize independent work when doing so materially improves wall-clock time, context quality, or independent verification.

Choose agent count automatically.

- Never place multiple concurrent writers in the same checkout.
- Parallel writes require isolated worktrees/checkouts and disjoint ownership.
- Treat shared schemas, ordered migrations, unstable interfaces, generated sources of truth, and scarce mutable test infrastructure as synchronization boundaries.
- Serialize dependent work when parallel execution would create coordination overhead or unsafe intermediate states.
- Never revert unrelated user changes.

Do not ask the user whether or how to parallelize.

## Methodology plugins

If Superpowers is installed:

- use TDD, systematic debugging, and verification methodology when useful;
- do not nest another scheduler under an already active native workflow;
- deduplicate equivalent planning, review, verification, and worktree setup.

If Ponytail is installed:

- prefer the simplest correct implementation;
- explicit requirements, safety, and repository invariants take precedence over minimization.

## Project facts

Read `.agentic/PROJECT.md` before substantive changes when it exists.

If it is missing or clearly stale, automatically discover durable project facts that will matter repeatedly and update the file when doing so materially helps future tasks.

## Long-running work

When work is likely to cross sessions, runtimes, pull requests, or human handoff, automatically create and maintain:

```text
.agent/tasks/<task>/
├── SPEC.md
├── STATE.md
└── DECISIONS.md
```

Use:

- `SPEC.md` for stable goal, acceptance criteria, and constraints;
- `STATE.md` for meaningful progress, verification status, blockers, and the next action;
- `DECISIONS.md` for durable rationale.

Update durable state at meaningful milestones. Do not ask the user to initialize or maintain it.

Do not persist native agent graphs, workflow queues, compaction state, or full transcripts.

## Autonomy and approval boundaries

Proceed without user approval for routine, reversible work that is within the objective and repository constraints.

Do not request approval for normal implementation work such as:

- reading or editing repository files;
- formatting, linting, tests, builds, and code generation;
- dependency installation/update that follows the existing stack and dependency policy;
- branch/worktree creation;
- `git add`, commits, rebases, and ordinary feature-branch maintenance;
- pushing non-default branches;
- creating or updating pull requests;
- review and verification.

Ask the user before an important design decision only when it materially changes long-lived system direction and cannot be inferred safely. Examples include major architecture boundaries, broad public API/data-contract changes, irreversible migration strategy, security/trust-boundary changes, or adoption of a foundational technology that materially changes the architecture.

Do not ask about reversible implementation details.

When work is ambiguous or a check fails, keep progressing within the stated
objective:

- choose the smallest reversible interpretation consistent with the documented
  product invariants;
- record assumptions and their consequences in the active task's `DECISIONS.md`;
- debug failed checks and continue all unaffected work instead of turning a
  routine failure into a user decision;
- report milestone outcomes, evidence, and the next action without requesting
  confirmation for that next action;
- ask only when the unresolved choice crosses an approval boundary above or no
  safe reversible path remains after investigation.

User corrections update the active objective. They do not require restarting
completed investigation or waiting for renewed approval of unaffected work.

The default branch is a hard integration boundary:

- never merge a pull request without explicit user approval immediately before merge;
- never locally merge into or directly push to the repository default branch without explicit user approval immediately before the action;
- preparing a PR, updating it, pushing its feature branch, and making it merge-ready do not require approval.

## Verification

Automatically identify and run the narrowest useful checks, then expand according to blast radius and risk.

Use independent review or verification when it materially reduces risk.

Deduplicate equivalent verification across the runtime, Superpowers, and other tools.

Do not declare completion while relevant verification is failing unless the failure is explicitly reported as a blocker.

## Review topology during execution

Preserve the review topology selected at objective intake.

For a stack:

- keep dependency order explicit;
- stabilize and verify a lower layer before building dependent behavior on top;
- do not wait for lower-layer merge when the upper layer can safely proceed against the stable lower-layer contract;
- fix lower-layer defects in the lower layer and propagate/rebase upward;
- do not collapse later dependent milestones into sequential default-branch-based PRs.

Execution topology does not determine PR topology.

## Dependency policy

- Use the latest stable dependency version compatible with project constraints.
- Update lockfiles when supported.
- Pin GitHub Actions to the full commit SHA of the latest stable release and include a version comment.
- Use pre-release versions only for an explicit reason.
