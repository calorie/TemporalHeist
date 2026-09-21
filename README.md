# Agentic Engineering Project Template

Policy version: **0.5.1**

A thin project template for https://github.com/calorie/agentic-engineering.

The template intentionally avoids custom orchestration scripts. Claude Code and Codex own execution, while the repository contract tells them to proactively optimize context, delegation, parallelism, long-task state, verification, and PR topology.

## Quick start

Create a repository from **Use this template**, then install the Plugin for the runtime you use.

### Claude Code

```bash
claude plugin marketplace add calorie/agentic-engineering
claude plugin install agentic-engineering@agentic-engineering
```

### Codex

```bash
codex plugin marketplace add calorie/agentic-engineering \
  --sparse .agents/plugins \
  --sparse plugins/agentic-engineering

codex plugin add agentic-engineering@agentic-engineering
```

The repository configuration already enables the Plugin after it is installed.

## Cost-aware execution

Do **not** run maximum effort for every task.

Start ordinary work at the model/runtime default. Escalate when work is long-running, codebase-wide, strongly parallelizable, hard to verify manually, or expensive to get wrong.

### Claude Code

This template does not persist ultracode.

For a high-leverage session where automatic Dynamic Workflow selection is desirable:

```bash
claude --effort ultracode
```

For ordinary work, launch Claude normally:

```bash
claude
```

Dynamic Workflow availability depends on the account and administrator settings.

### Codex

This template enables multi-agent tools but does not pin project-level Ultra reasoning.

Use the normal runtime/model default for ordinary work and increase reasoning/delegation when the task justifies the additional usage.

## Automatic optimization

For substantive work, the agent should automatically decide:

- the minimum useful effort level;
- what to keep in the primary context;
- what to delegate to fresh subagents;
- what independent work to parallelize;
- whether isolated worktrees are needed;
- whether durable task state is needed;
- what verification is sufficient;
- the final Git/PR topology.

The user should not need to manage these choices.

The native runtime still owns the execution mechanism; the repository policy makes proactive optimization the default behavior.

## Superpowers and Ponytail

Superpowers is optional and should be treated as methodology, not as a second scheduler. TDD, systematic debugging, and verification compose well with native runtime execution; avoid nested scheduling and duplicate review/worktree setup.

Ponytail is optional and should bias implementation toward the simplest correct solution without overriding explicit requirements, safety, or repository invariants.

## Context and durable state

Keep the primary context lean by delegating noisy/self-contained work and returning compact conclusions. Rely on runtime-native compaction rather than asking the user to manage context cleanup.

Use `.agentic/PROJECT.md` for durable repository facts.

When work is likely to survive sessions or human handoff, automatically create and maintain:

```text
.agent/tasks/<task>/
├── SPEC.md
├── STATE.md
└── DECISIONS.md
```

No custom compaction, active-task, or runtime checkpoint framework is required. The agent maintains durable state automatically at meaningful milestones.

## Review topology

- one focused change -> one PR;
- independent changes -> independent PRs;
- dependent but separately reviewable changes -> GitHub Stacked PRs.

## Existing 0.4.x repository migration

Fetch the current template and update the small repository contract:

```bash
git remote add agentic-template https://github.com/calorie/agentic-repo-template.git 2>/dev/null || true
git fetch agentic-template main

git checkout agentic-template/main -- \
  AGENTS.md \
  CLAUDE.md \
  .claude/settings.json \
  .codex/config.toml \
  .agentic/PROJECT.md \
  .github/workflows/agentic-contract.yml \
  .gitignore
```

Remove obsolete 0.4.x infrastructure if it exists:

```bash
git rm -f .agentic/agentic.json 2>/dev/null || true
git rm -rf scripts 2>/dev/null || true
git rm -rf .agent/plans 2>/dev/null || true
git rm -f .agent/tasks/.gitignore 2>/dev/null || true
```

Preserve application code and any meaningful durable task files.

Then update/reinstall the central Plugin with the normal Claude Code or Codex Plugin commands above.

## Repository layout

```text
.
├── AGENTS.md
├── CLAUDE.md
├── .claude/settings.json
├── .codex/config.toml
├── .agentic/PROJECT.md
└── .agent/tasks/
```

That is intentionally most of the agent infrastructure.
