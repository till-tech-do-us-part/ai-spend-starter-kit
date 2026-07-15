# Token usage meter

See where subscription-CLI tokens go, then connect measurable waste to caching, lean-context, and cheaper-routing habits. The meter reads synthetic or local Claude Code and Codex JSONL logs, normalizes token counts, and produces terminal, JSON, or self-contained HTML reports.

## Build and run

This repository version is unpublished. Build it and invoke the generated CLI directly:

```bash
npm ci
npm run build
node dist/cli.js --since 7d
node dist/cli.js --since all --source claude --claude-dir test/fixtures/claude --json
node dist/cli.js --since 30d --html usage.html
```

Options include `--source claude,codex`, explicit source directories, `--project`, and `--config`. Configuration is JSON and can override `lowCacheHit`, `contextBloatMedianInput`, `staleSessionTurns`, `staleSessionHours`, `heavyModelShare`, `minShortSessions`, `shortSessionMaxTurns`, and the `modelTiers.frontier` or `modelTiers.cheap` regex-source arrays.

## What the flags mean

| Flag | Lever | Matching guide habit |
|---|---|---|
| `low-cache-hit` | Prompt caching | Design for cache reuse |
| `context-bloat` | Lean context | Scope every read |
| `stale-session` | Lean context | Start fresh when the task changes |
| `heavy-model-routine` | Cheaper defaults / routing | Tier the work |

Use the [lean-context guide](../guide/lean-context.md) and [token-efficiency skill](../skill/token-efficiency/) to change the habit, then rerun the meter to confirm the result.

## Privacy

The meter is 100% local and has no runtime dependencies. It makes no network calls, never puts prompt or response content into its event model or reports, and opens log trees read-only. It writes only the HTML path you explicitly request; JSON is emitted to standard output. Missing default log directories are reported and do not fail the run.
