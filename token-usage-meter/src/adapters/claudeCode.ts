import { basename } from "node:path";
import { lines, scan } from "../fs-scan.js";
import type { SourceDiagnostic, UsageEvent } from "../types.js";

type Candidate = UsageEvent & { identity: string; total: number };
const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const project = (cwd: unknown): string => typeof cwd === "string" && cwd ? (cwd.split(/[\\/]/).filter(Boolean).pop() ?? "unknown") : "unknown";
export async function readClaude(root: string): Promise<{ events: UsageEvent[]; diagnostic: SourceDiagnostic }> {
  const files = await scan(root, path => path.endsWith(".jsonl"));
  const best = new Map<string, Candidate>(); let skipped = 0;
  for (const file of files) await lines(file, line => {
    let row: any; try { row = JSON.parse(line); } catch { skipped++; return; }
    const usage = row?.message?.usage;
    if (row?.type !== "assistant" || !usage || row?.message?.model === "<synthetic>") return;
    const inputTokens = number(usage.input_tokens), outputTokens = number(usage.output_tokens), cacheReadTokens = number(usage.cache_read_input_tokens), cacheCreationTokens = number(usage.cache_creation_input_tokens);
    const total = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
    const messageId = row?.message?.id ?? row?.requestId ?? row?.uuid;
    const sessionId = typeof row?.sessionId === "string" && row.sessionId ? row.sessionId : basename(file, ".jsonl");
    const timestamp = typeof row?.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp)) ? new Date(row.timestamp).toISOString() : "";
    if (!messageId || !timestamp || total === 0) { skipped++; return; }
    const candidate: Candidate = { source: "claude-code", timestamp, project: project(row.cwd), sessionId, model: typeof row.message.model === "string" ? row.message.model : "unknown", inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, identity: `${sessionId}|${messageId}`, total };
    const old = best.get(candidate.identity);
    if (!old || candidate.total > old.total || (candidate.total === old.total && candidate.timestamp < old.timestamp)) best.set(candidate.identity, candidate);
  });
  const events = [...best.values()].sort((a,b) => a.timestamp.localeCompare(b.timestamp)).map(({identity: _i, total: _t, ...event}) => event);
  return { events, diagnostic: { found: files.length > 0, fileCount: files.length, skipped, empty: events.length === 0 } };
}
