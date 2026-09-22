# Agent contract

This repository uses a minimal, cost-aware engineering policy.

The user should normally provide only the engineering objective. Automatically optimize execution using the runtime's native capabilities.

## Automatic optimization

For every substantive task, automatically decide:

1. the minimum useful reasoning/effort level;
2. what should remain in the primary context;
3. what should be delegated to fresh subagents;
4. what independent work should run in parallel;
5. whether isolated worktrees/checkouts are required;
6. whether durable task state is required;
7. what verification evidence is sufficient;
8. whether the result should be one PR, independent PRs, or a Stacked PR.

Do not ask the user to make orchestration decisions unless a real product, authorization, or irreversible-action decision requires input.

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

The default branch is a hard integration boundary:

- never merge a pull request without explicit user approval immediately before merge;
- never locally merge into or directly push to the repository default branch without explicit user approval immediately before the action;
- preparing a PR, updating it, pushing its feature branch, and making it merge-ready do not require approval.

## Verification

Automatically identify and run the narrowest useful checks, then expand according to blast radius and risk.

Use independent review or verification when it materially reduces risk.

Deduplicate equivalent verification across the runtime, Superpowers, and other tools.

Do not declare completion while relevant verification is failing unless the failure is explicitly reported as a blocker.

## Review topology

Choose automatically:

- one focused reviewable change -> one PR;
- independent reviewable changes -> independent PRs;
- dependent but independently reviewable changes -> GitHub Stacked PRs.

Use Stacked PRs when they improve reviewability without adding unnecessary coordination cost.

Execution topology does not determine PR topology.

## Dependency policy

- Use the latest stable dependency version compatible with project constraints.
- Update lockfiles when supported.
- Pin GitHub Actions to the full commit SHA of the latest stable release and include a version comment.
- Use pre-release versions only for an explicit reason.
