# Keep AI spend flat while usage grows — a starter kit for teams without a platform team.

Stand up a working AI gateway in an afternoon. You do not need a platform team to run it. The stack and the token-efficiency practices are free and open source.

This kit operationalizes five cost levers described by Brian Armstrong; it does not reproduce his post.

## The five levers

| Lever | Where it lives |
|---|---|
| Cheaper defaults | [`gateway/config.yaml`](gateway/config.yaml) — the `default` tier |
| Smart routing | [`gateway/config.yaml`](gateway/config.yaml) — named job tiers and fallbacks |
| Prompt caching | Redis in [`gateway/docker-compose.yml`](gateway/docker-compose.yml) plus the caching block in `config.yaml` |
| Lean context | [`guide/lean-context.md`](guide/lean-context.md) plus [`skill/token-efficiency/`](skill/token-efficiency/) |
| Spend visibility | Gateway dashboard and per-engineer keys in the [`gateway/README.md`](gateway/README.md) tour |

The core idea is small: name the job, not the model. Routine work goes to `default`; architecture and hard debugging go to `planning`; independent checks go to `review`.

## Quickstart

You need Docker with the Compose plugin, `curl`, `openssl`, and a Gemini API key.

1. Clone the repository and enter the gateway directory.

   ```bash
   git clone https://github.com/till-tech-do-us-part/ai-spend-starter-kit.git
   cd ai-spend-starter-kit/gateway
   ```

2. Copy the environment file. Set the four required values: `POSTGRES_PASSWORD`, `LITELLM_MASTER_KEY`, `LITELLM_SALT_KEY`, and `GEMINI_API_KEY`. Everything else is optional; keep provider key examples commented unless you use the cross-provider review recipe. Gemini powers `default`, its fallback, `planning`, and `review`.

   ```bash
   cp .env.example .env
   echo "sk-$(openssl rand -hex 24)"       # LITELLM_MASTER_KEY
   echo "sk-salt-$(openssl rand -hex 24)"  # LITELLM_SALT_KEY
   openssl rand -hex 16                    # POSTGRES_PASSWORD
   # Edit .env. Replace the four required REPLACE-ME values.
   ```

   Copy the three command outputs into `.env`. Keep the random portion of all three generated secrets hex-only. The full values must contain no `$`, quotes, or spaces because Compose interpolates unquoted `.env` values.

3. Start the three containers.

   ```bash
   docker compose up -d
   ```

4. Run the provider-backed check. It creates a named virtual key and makes three requests.

   ```bash
   ./verify.sh
   ```

5. Open [http://localhost:4000/ui](http://localhost:4000/ui). By default, log in as `admin` with `LITELLM_MASTER_KEY`; optional `UI_USERNAME` and `UI_PASSWORD` values override that login.

For the setup details and dashboard tour, read the [gateway guide](gateway/README.md).

## What this is not

Version 1 deliberately excludes SSO, multi-tenant setups, Kubernetes deployment, high availability, semantic caching, custom routing code, PII guardrails, and a bundled chat UI. If you need those, you probably have a platform team; this kit starts one step earlier.

## Results from my lab

> Dogfood run in progress — one-person numbers land here, labeled as exactly that.

No provider-backed result is claimed by this repository yet. The offline validator and no-secret CI smoke test prove structure and boot behavior; the real-key run is the separate dogfood gate.

## No Docker? The hosted path

A hosted gateway such as OpenRouter can provide one endpoint and model choice without local infrastructure. The trade is plain: your request and spend data live with a third party, and its routing, retention, and availability policies become part of your system. The lean-context guide and skill still work unchanged.

## Troubleshooting

| Problem | Symptom | Likely cause | Fix |
|---|---|---|---|
| Docker not running | `docker compose` cannot connect to the daemon | Docker is stopped or missing | Start Docker Desktop or the Docker service, then rerun `docker compose up -d`. |
| Port 4000 busy | LiteLLM fails to publish `127.0.0.1:4000` | Another process already owns the port | Stop that process or change the host-side port and `LITELLM_BASE_URL` together. |
| Bad or missing Gemini key | Verify step 1 or 2 returns a provider authentication error | `GEMINI_API_KEY` is absent, still a placeholder, revoked, or restricted | Create a current key in Google AI Studio, update `gateway/.env`, and run `docker compose up -d litellm` to recreate LiteLLM with the new value. |
| Dashboard login | The UI rejects the credentials | The default or optional override is wrong | Use `admin` and `LITELLM_MASTER_KEY`, or the optional `UI_USERNAME` and `UI_PASSWORD` overrides. |
| No cache hit on verify step 3 | The repeat lacks `x-litellm-cache-key` | Redis is unhealthy, caching is disabled, or the request changed | Run `docker compose ps`, inspect Redis logs, and confirm the caching block in `config.yaml`. |
| Key-generate failure | `POST /key/generate` returns 401, 400, or 5xx | Wrong master key, Postgres is not ready, or alias `verify-script` already exists | Check readiness and `LITELLM_MASTER_KEY`; if rerunning, delete the old `verify-script` key in the dashboard first. |
| Gateway not up | Curl cannot connect to localhost:4000 | Containers are starting or LiteLLM exited | Run `docker compose ps` and `docker compose logs litellm`; wait for liveliness before retrying. |

## More

[Contributing](CONTRIBUTING.md) · [MIT license](LICENSE) · [Token-efficiency skill](skill/token-efficiency/README.md) · [Lean-context guide](guide/lean-context.md)
