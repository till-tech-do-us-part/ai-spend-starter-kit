import { basename } from "node:path";
import { lines, scan } from "../fs-scan.js";
import type { SourceDiagnostic, UsageEvent } from "../types.js";

const uuidAtEnd = /[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const project = (cwd: unknown): string => typeof cwd === "string" && cwd ? (cwd.split(/[\\/]/).filter(Boolean).pop() ?? "unknown") : "unknown";
const tuple = (v: any): string => [v?.input_tokens, v?.cached_input_tokens, v?.output_tokens, v?.reasoning_output_tokens, v?.total_tokens].map(number).join("|");
export async function readCodex(root: string): Promise<{ events: UsageEvent[]; diagnostic: SourceDiagnostic }> {
  const files = await scan(root, path => /\/rollout-.*\.jsonl$/.test(path));
  const events: UsageEvent[] = []; let skipped = 0;
  for (const file of files) {
    const ownId = basename(file, ".jsonl").match(uuidAtEnd)?.[0];
    let ownMeta: any, sessionId: unknown, context: any;
    const canonical = new Map<string, UsageEvent>();
    await lines(file, line => {
      let row: any; try { row = JSON.parse(line); } catch { skipped++; return; }
      if (!ownMeta) {
        if (row?.type === "session_meta" && row?.payload && typeof row.payload.id === "string" && row.payload.id.toLowerCase() === ownId?.toLowerCase()) {
          ownMeta = row; sessionId = row.payload.session_id ?? row.payload.id; context = row.payload;
        }
        return;
      }
      if (row?.type === "turn_context" && row?.payload) { context = row.payload; return; }
      if (row?.type !== "event_msg" || row?.payload?.type !== "token_count") return;
      const info = row.payload.info; if (info === null || !info?.last_token_usage || !info?.total_token_usage) { skipped++; return; }
      const key = tuple(info.total_token_usage);
      const last = info.last_token_usage, cached = number(last.cached_input_tokens), input = number(last.input_tokens) - cached;
      const timestamp = typeof row.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp)) ? new Date(row.timestamp).toISOString() : "";
      if (!timestamp) { skipped++; return; }
      const event: UsageEvent = { source: "codex", timestamp, project: project(context?.cwd ?? ownMeta.payload.cwd), sessionId: String(sessionId), model: typeof context?.model === "string" ? context.model : typeof ownMeta.payload.model === "string" ? ownMeta.payload.model : "unknown", ...(typeof context?.effort === "string" ? { effort: context.effort } : {}), inputTokens: input, outputTokens: number(last.output_tokens), cacheReadTokens: cached, cacheCreationTokens: 0 };
      const previous = canonical.get(key); if (!previous || event.timestamp < previous.timestamp) canonical.set(key, event);
    });
    if (!ownMeta) { skipped++; continue; }
    events.push(...canonical.values());
  }
  events.sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  return { events, diagnostic: { found: files.length > 0, fileCount: files.length, skipped, empty: events.length === 0 } };
}
