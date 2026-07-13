# Lean context: six habits for coding with AI

Context is a working surface. Keep it focused enough to reason clearly and large enough to do the job. These habits take about five minutes to learn and work with any assistant.

## 1. Scope every read

Tell the assistant which files, symbols, or sections matter. Search before opening large files. Do not pay to load a whole repository when one function answers the question, and do not re-read material already in the session.

## 2. Start fresh when the task changes

Use one session for one coherent task. When you switch from a database bug to landing-page copy, open a fresh session and carry over a one-line handoff note. If a long session starts losing constraints or repeating itself, summarize the current state and restart instead of compacting more unrelated history.

## 3. Audit connected tools

Disconnect tools and servers you are not using. Their descriptions can consume context on every message even when no call is made. Reconnect them when the job needs them.

## 4. Tier the work

Use cheaper models or modes for mechanical jobs: renames, boilerplate, formatting, and bulk edits. Use frontier reasoning for architecture, ambiguous tradeoffs, and hard debugging. Name the job, not the model, so you can update the underlying choice without retraining the team.

## 5. Keep output economical

Ask for outcomes, decisions, and proof. Do not ask the assistant to paste back files or diffs already available in your editor. A terse summary plus failing details is usually enough.

## 6. Remove waste, not thought

The goal is fewer tokens wasted, not fewer tokens used. Extra context is worthwhile when it prevents a wrong edit, explains an important tradeoff, or verifies the result. Cut repetition and irrelevant state; keep evidence.

Before sending the next prompt, ask: is this the same task, the smallest useful scope, and the right reasoning tier?
