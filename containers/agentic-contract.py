import json
import re
import tomllib
from pathlib import Path

claude = json.loads(Path('.claude/settings.json').read_text())
assert 'ultracode' not in claude
assert claude['enabledPlugins']['agentic-engineering@agentic-engineering'] is True
claude_ask = set(claude['permissions']['ask'])
for command in ['Bash(gh pr merge *)', 'Bash(git merge *)', 'Bash(git push origin main *)',
                'Bash(git push origin master *)', 'Bash(git push origin trunk *)']:
    assert command in claude_ask
codex = tomllib.loads(Path('.codex/config.toml').read_text())
assert 'model_reasoning_effort' not in codex
assert codex['agents']['enabled'] is True
assert codex['plugins']['agentic-engineering@agentic-engineering']['enabled'] is True
assert codex['default_permissions'] == 'agentic-development'
granular = codex['approval_policy']['granular']
assert granular['sandbox_approval'] is False
assert granular['rules'] is True
assert granular['request_permissions'] is False
profile = codex['permissions']['agentic-development']
assert profile['extends'] == ':workspace'
assert profile['filesystem'][':workspace_roots']['.git'] == 'write'
assert profile['network']['enabled'] is True
pattern = re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]')
for name in ['README.md', 'CLAUDE.md', 'AGENTS.md', '.agentic/PROJECT.md',
             '.codex/config.toml', '.codex/rules/approval-boundaries.rules',
             '.github/pull_request_template.md']:
    assert not pattern.search(Path(name).read_text()), name
for name in ['CLAUDE.md', 'AGENTS.md', '.agentic/PROJECT.md', '.claude/settings.json',
             '.codex/config.toml', '.codex/rules/approval-boundaries.rules', '.agent/tasks']:
    assert Path(name).exists(), name
for name in ['.agentic/agentic.json', 'scripts', '.agent/plans']:
    assert not Path(name).exists(), name
rules = Path('.codex/rules/approval-boundaries.rules').read_text()
assert 'pattern = ["gh", "pr", "merge"]' in rules
assert 'decision = "prompt"' in rules
print('Agent infrastructure contract passed in container')
