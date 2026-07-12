# Install the token-efficiency skill

Copy the whole `token-efficiency` directory, not just the Markdown body. The directory name and `SKILL.md` frontmatter are part of the skill.

Built and tested in Claude Code; the `SKILL.md` format is read natively by the others.

## Claude Code

For one project, copy the directory to `.claude/skills/token-efficiency/`. For all projects, use `~/.claude/skills/token-efficiency/`. Start a new session and ask for a coding task; Claude loads the skill when its description matches.

## Codex

Copy the directory to `$CODEX_HOME/skills/token-efficiency/`; the usual default is `~/.codex/skills/token-efficiency/`. Start a new Codex session so skill discovery runs again.

## Copilot CLI

For one repository, copy the directory to `.github/skills/token-efficiency/`. For a personal install, use `~/.copilot/skills/token-efficiency/`. Run `/skills list` in Copilot CLI to confirm discovery.

## Gemini CLI

Copy the directory to `.gemini/skills/token-efficiency/` for one workspace or `~/.gemini/skills/token-efficiency/` for your user. Run `gemini skills list` to confirm it is enabled.

The same rules are also available as a tool-independent [human guide](../../guide/lean-context.md).
