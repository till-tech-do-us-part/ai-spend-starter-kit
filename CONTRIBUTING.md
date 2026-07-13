# Contributing

Small improvements are welcome. Good-first-issues are the invited entry path: provider examples, more assistant install notes, an optional chat-UI guide, Windows notes, and image digest pinning are all useful bounded changes.

## Test locally

From the repository root, run:

```bash
bash scripts/validate.sh
```

This is the required offline proof. It parses and checks the YAML, validates the skill and Markdown links, scans for real-key-shaped strings, checks Bash syntax, and runs Docker Compose and ShellCheck when those tools are installed.

## What CI runs

CI runs the validator with Docker and ShellCheck available. It also resolves the Compose file, boots LiteLLM, Postgres, and Redis with dummy values, waits for liveness and readiness, checks the four model groups through authenticated `/v1/models`, and probes the admin UI. It does not call a model provider.

## Pull requests

- Keep a pull request small and focused on one thing.
- Explain the user-visible reason for the change.
- Keep secrets out of examples, logs, and fixtures.
- Run the local validator and leave CI green.

Provider-backed dogfood uses real keys outside CI. Do not add provider secrets to a pull request to prove a route works.
