export type Source = "claude-code" | "codex";
export type TokenSums = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number };
export type UsageEvent = TokenSums & {
  source: Source; timestamp: string; project: string; sessionId: string; model: string; effort?: string;
};
export type Tier = "frontier" | "cheap" | "other";
export type Bucket = TokenSums & { totalTokens: number; turnCount: number };
export type SessionRollup = Bucket & {
  source: Source; sessionId: string; start: string; end: string; eligibleTurnCount: number;
  medianTotalInputPerTurn: number; perTier: Record<Tier, number>;
};
export type Rollups = {
  summary: TokenSums & { totalTokens: number; cacheHitRatio: number | null; sessionCount: number; start: string | null; end: string | null; topProject: string | null; topModel: string | null };
  byDay: Record<string, Bucket>; byProject: Record<string, Bucket>; byModel: Record<string, Bucket>; bySession: Record<string, SessionRollup>;
};
export type Flag = { id: "low-cache-hit" | "context-bloat" | "stale-session" | "heavy-model-routine"; lever: string; severity: "warning"; message: string; evidence: string; guideLink: string };
export type SourceDiagnostic = { found: boolean; fileCount: number; skipped: number; empty: boolean };
export type Diagnostics = Record<Source, SourceDiagnostic>;
