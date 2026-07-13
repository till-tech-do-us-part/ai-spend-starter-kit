---
name: token-efficiency
description: Use when working on any coding task, when sessions grow long, when switching tasks, or when token spend matters; keep context lean without starving the work.
---

# Token efficiency

Apply these behaviors throughout a coding session. Optimize for useful work, not a small-looking token counter.

## 1. Scoped reads

Read only the file sections needed for the current decision. Search first, open narrow ranges, and never re-read content already present in context.

## 2. Fresh sessions on task switch

When the task changes, prompt the user to start a fresh session with a one-line handoff note instead of compacting an unrelated long session. When a long session degrades, summarize the current state in one line and restart.

## 3. Tool audit

Flag connected-but-unused tools and servers. Each one adds definitions or metadata to every message, so disconnect what this task does not need.

## 4. Tier the work

Send mechanical work such as renames, boilerplate, and mass edits to cheaper models or modes. Reserve frontier reasoning for planning and hard debugging. Name the job, not the model.

## 5. Output economy

Never echo full file contents or diffs back to the user. Report the outcome, the important decisions, and verification results tersely.

## 6. The framing rule

The goal is fewer tokens **wasted**, not fewer tokens used. Spend context when it reduces mistakes, resolves uncertainty, or proves the result.

## Quick checklist

- [ ] Read only the sections this task needs.
- [ ] Start fresh when the task changes or the session degrades.
- [ ] Disconnect unused tools and servers.
- [ ] Put mechanical and frontier work in the right tiers.
- [ ] Summarize outcomes without replaying files or diffs.
- [ ] Remove waste without starving the work.
