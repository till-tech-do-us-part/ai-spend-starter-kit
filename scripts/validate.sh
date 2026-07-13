#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

verify_index=$(git ls-files -s -- gateway/verify.sh)
[[ "$verify_index" == 100755\ * ]] \
  || fail "gateway/verify.sh must be executable in the git index (mode 100755)"
printf 'OK: gateway/verify.sh is executable in the git index\n'

PYTHON_BIN=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 \
    && "$candidate" -c 'import sys, yaml; assert sys.version_info.major == 3' >/dev/null 2>&1; then
    PYTHON_BIN=$candidate
    break
  fi
done
[[ -n "$PYTHON_BIN" ]] || fail "Python 3 with PyYAML is required"
printf 'OK: using %s for Python validation\n' "$PYTHON_BIN"

"$PYTHON_BIN" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

root = Path.cwd()


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


try:
    config_path = root / "gateway/config.yaml"
    compose_path = root / "gateway/docker-compose.yml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    compose = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    check(isinstance(config, dict), "gateway/config.yaml must contain a mapping")
    check(isinstance(compose, dict), "gateway/docker-compose.yml must contain a mapping")
    print("OK: gateway YAML files parse")

    models = config.get("model_list")
    check(isinstance(models, list), "model_list must be a list")
    check(
        {item.get("model_name") for item in models}
        == {"default", "default-fallback", "planning", "review"},
        "active model groups must be default, default-fallback, planning, and review",
    )
    check(
        all(
            isinstance(item.get("litellm_params", {}).get("model"), str)
            and item.get("litellm_params", {}).get("model").startswith("gemini/")
            for item in models
        ),
        "every active model_list entry must use a gemini/ provider model "
        "(shipping default is Gemini-only; add non-Gemini providers only as commented opt-in recipes)",
    )
    check(
        all(
            item.get("litellm_params", {}).get("api_key")
            == "os.environ/GEMINI_API_KEY"
            for item in models
        ),
        "every active model_list entry must use api_key: os.environ/GEMINI_API_KEY",
    )
    router = config.get("router_settings", {})
    fallbacks = router.get("fallbacks")
    check(isinstance(fallbacks, list), "router_settings.fallbacks must be a list")
    check(
        {"default": ["default-fallback"]} in fallbacks,
        "fallbacks must route default to default-fallback",
    )
    check(type(router.get("num_retries")) is int, "num_retries must be an integer")
    check(type(router.get("timeout")) is int, "timeout must be an integer")

    settings = config.get("litellm_settings", {})
    check(settings.get("cache") is True, "LiteLLM cache must be enabled")
    cache = settings.get("cache_params", {})
    check(cache.get("type") == "redis", "cache type must be redis")
    check(cache.get("host") == "redis", "cache host must be redis")
    check(cache.get("port") == 6379, "cache port must be 6379")
    check(type(cache.get("ttl")) is int, "cache ttl must be an integer")
    check(settings.get("drop_params") is True, "drop_params must be enabled")

    general = config.get("general_settings", {})
    check(
        general.get("master_key") == "os.environ/LITELLM_MASTER_KEY",
        "master key must come from LITELLM_MASTER_KEY",
    )
    check(
        general.get("database_url") == "os.environ/DATABASE_URL",
        "database URL must come from DATABASE_URL",
    )
    for model in models:
        api_key = model.get("litellm_params", {}).get("api_key")
        check(
            isinstance(api_key, str) and api_key.startswith("os.environ/"),
            f"{model.get('model_name')} api_key must be an environment reference",
        )
    print("OK: gateway/config.yaml has the required routes, fallback, cache, and env references")

    services = compose.get("services", {})
    check(set(services) == {"litellm", "postgres", "redis"}, "compose must define exactly three services")
    for name, service in services.items():
        check("healthcheck" in service, f"{name} must have a healthcheck")

    image_patterns = {
        "litellm": re.compile(r"^ghcr\.io/berriai/litellm:v\d+\.\d+\.\d+$"),
        "postgres": re.compile(r"^postgres:\d+\.\d+-alpine$"),
        "redis": re.compile(r"^redis:\d+\.\d+\.\d+-alpine$"),
    }
    for name, pattern in image_patterns.items():
        check(pattern.fullmatch(services[name].get("image", "")) is not None, f"{name} image must use a full release tag")

    volumes = compose.get("volumes", {})
    check({"postgres_data", "redis_data"}.issubset(volumes), "postgres and redis named volumes must be declared")
    check(
        any(str(mount).startswith("postgres_data:") for mount in services["postgres"].get("volumes", [])),
        "postgres must mount postgres_data",
    )
    check(
        any(str(mount).startswith("redis_data:") for mount in services["redis"].get("volumes", [])),
        "redis must mount redis_data",
    )
    litellm_environment = services["litellm"].get("environment", {})
    check("LITELLM_SALT_KEY" in litellm_environment, "litellm must pass through LITELLM_SALT_KEY")
    check(
        services["litellm"].get("ports") == ["${LITELLM_BIND_HOST:-127.0.0.1}:4000:4000"],
        "litellm must bind port 4000 to localhost by default",
    )
    env_files = services["litellm"].get("env_file")
    check(
        isinstance(env_files, list)
        and any(
            isinstance(item, dict)
            and item.get("path") == ".env"
            and item.get("required") is False
            for item in env_files
        ),
        "litellm env_file must use optional long syntax",
    )
    print("OK: compose has three healthy services, exact tags, named volumes, and optional env loading")

    secret_patterns = {
        "Google API key": re.compile(r"AIza[0-9A-Za-z_-]{35}"),
        "Anthropic API key": re.compile(r"sk-ant-[0-9A-Za-z_-]{20,}"),
        "OpenAI-style API key": re.compile(r"sk-[0-9A-Za-z]{20,}"),
        "GitHub token": re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}"),
    }
    findings = []
    for path in root.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for line_number, line in enumerate(text.splitlines(), 1):
            if "REPLACE-ME" in line:
                continue
            for label, pattern in secret_patterns.items():
                if pattern.search(line):
                    findings.append(f"{path.relative_to(root)}:{line_number} ({label})")
    check(not findings, "real-key-shaped strings found: " + ", ".join(findings))
    print("OK: no real-key-shaped strings found")
except Exception as exc:
    print(f"FAIL: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY

while IFS= read -r -d '' script; do
  bash -n "$script" || fail "bash syntax check failed for ${script#./}"
done < <(find . -type f -name '*.sh' -print0)
printf 'OK: bash syntax is valid for every shell script\n'

"$PYTHON_BIN" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

import yaml

root = Path.cwd()

try:
    skill_path = root / "skill/token-efficiency/SKILL.md"
    skill_text = skill_path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", skill_text, re.DOTALL)
    if match is None:
        raise AssertionError("SKILL.md needs YAML frontmatter")
    frontmatter = yaml.safe_load(match.group(1))
    if frontmatter.get("name") != "token-efficiency":
        raise AssertionError("SKILL.md name must be token-efficiency")
    description = frontmatter.get("description")
    if not isinstance(description, str) or not 20 <= len(description) <= 1024 or "when" not in description.lower():
        raise AssertionError("SKILL.md description must be 20-1024 characters and contain 'when'")
    print("OK: SKILL.md frontmatter is valid")

    link_pattern = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
    missing = []
    for markdown in root.rglob("*.md"):
        if ".git" in markdown.parts:
            continue
        text = markdown.read_text(encoding="utf-8")
        for raw_target in link_pattern.findall(text):
            target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
            if not target or target.startswith("#") or re.match(r"^(?:https?://|mailto:)", target, re.I):
                continue
            target = unquote(target.split("#", 1)[0])
            if target and not (markdown.parent / target).resolve().exists():
                missing.append(f"{markdown.relative_to(root)} -> {target}")
    if missing:
        raise AssertionError("missing relative Markdown targets: " + ", ".join(missing))
    print("OK: every relative Markdown link resolves")
except Exception as exc:
    print(f"FAIL: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY

if command -v docker >/dev/null 2>&1; then
  if [[ -f gateway/.env ]]; then
    compose_env=gateway/.env
  else
    compose_env=gateway/.env.example
  fi
  docker compose --env-file "$compose_env" -f gateway/docker-compose.yml config -q \
    || fail "docker compose config failed"
  printf 'OK: docker compose config is valid with %s\n' "$compose_env"
else
  printf 'SKIP: docker not present (CI covers this)\n'
fi

if command -v shellcheck >/dev/null 2>&1; then
  scripts_to_check=()
  while IFS= read -r -d '' script; do
    scripts_to_check[${#scripts_to_check[@]}]="$script"
  done < <(find . -type f -name '*.sh' -print0)
  shellcheck "${scripts_to_check[@]}" || fail "shellcheck failed"
  printf 'OK: shellcheck passed\n'
else
  printf 'SKIP: shellcheck not present (CI covers this)\n'
fi

printf 'OK: offline structural validation passed\n'
