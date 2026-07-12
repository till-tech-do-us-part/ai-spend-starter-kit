# Gateway setup

This stack gives a small team one API endpoint, job-based routes, an exact-match cache, and spend history. It runs locally in three containers.

## What you are standing up

```text
engineer or app
      |
      v
LiteLLM gateway :4000 ----> Gemini / optional providers
      |       |
      |       +---- Redis: exact-match response cache
      +------------ Postgres: virtual keys and spend history
```

Postgres and Redis use named Docker volumes, so their data survives ordinary container restarts.

## Prerequisites

- Docker with the Compose plugin
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

Anthropic and OpenAI keys are optional. The quickstart uses Gemini for `default`, `default-fallback`, and `planning`.

## Setup

1. Create the real environment file.

   ```bash
   cd gateway
   cp .env.example .env
   ```

2. Replace every `REPLACE-ME` value. Generate a random `LITELLM_MASTER_KEY` beginning with `sk-`, a strong `POSTGRES_PASSWORD`, and a long random `LITELLM_SALT_KEY`. A password manager is enough; `openssl rand -hex 32` is another option.

   `LITELLM_SALT_KEY` encrypts stored credentials in Postgres. Generate it once and **never change it after first boot**, or existing encrypted keys will become unreadable.

   Set `UI_USERNAME` and `UI_PASSWORD` for the dashboard. They are not the master key. Add the required `GEMINI_API_KEY`; leave optional provider values as documented until you activate those routes.

3. Start the stack and check its status.

   ```bash
   docker compose up -d
   docker compose ps
   ```

4. Run the three-request proof.

   ```bash
   ./verify.sh
   ```

The script creates a virtual key named `verify-script`, calls the cheap and planning tiers, repeats the cheap request, and requires LiteLLM's cache-hit header.

## Dashboard tour

Open [http://localhost:4000/ui](http://localhost:4000/ui). Log in with `UI_USERNAME` and `UI_PASSWORD`. `LITELLM_MASTER_KEY` is for API administration, not UI login.

Start with the Keys page:

1. Generate one virtual key per engineer or application. Give each a useful alias.
2. Put related people and applications into teams.
3. Use the spend views to compare cost by key, team, model, and time period.

That is the visibility lever: every request carries an attributable virtual key. If you set `max_budget` on a key, treat it as a distant hard ceiling, not an alert. LiteLLM will reject requests when the ceiling is reached.

## Point your tools at it

Any tool that supports the OpenAI API shape can use the gateway. Supply a virtual key, not the master key.

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="YOUR_VIRTUAL_KEY",
)

response = client.chat.completions.create(
    model="default",
    messages=[{"role": "user", "content": "Summarize this function."}],
)
```

Subscription-based assistants such as Claude Max and ChatGPT plans cannot route through an API gateway. This stack handles API-key traffic only.

## Updating models

Edit [`config.yaml`](config.yaml), keeping the public tier names stable. Then restart only LiteLLM:

```bash
docker compose restart litellm
```

Check current provider names before an update. Exact model IDs age faster than the job tiers.

## Activating `review`

Add a real `ANTHROPIC_API_KEY` to `.env`, then restart LiteLLM. Calls using `model: review` will go to Claude Sonnet 5, a different family from the Gemini writer routes.
