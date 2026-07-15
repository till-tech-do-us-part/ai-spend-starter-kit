import { defaults, type MeterConfig } from "./config.js";
import type { Flag, Rollups } from "./types.js";

const guide = "../guide/lean-context.md";
export function analyze(rollups: Rollups, config: MeterConfig = defaults): Flag[] {
  const flags: Flag[]=[]; const s=rollups.summary, denominator=s.cacheReadTokens+s.inputTokens;
  if (denominator>0 && s.cacheReadTokens/denominator<config.lowCacheHit) flags.push({id:"low-cache-hit",lever:"Prompt caching",severity:"warning",message:"Cache reuse is below the configured target.",evidence:`${(s.cacheReadTokens/denominator*100).toFixed(1)}% cache hit`,guideLink:`${guide}#3-design-for-cache-reuse`});
  for (const session of Object.values(rollups.bySession)) {
    if (session.medianTotalInputPerTurn>config.contextBloatMedianInput) flags.push({id:"context-bloat",lever:"Lean context",severity:"warning",message:"A session carries a large median context.",evidence:`${session.source}|${session.sessionId}: ${session.medianTotalInputPerTurn} tokens`,guideLink:`${guide}#1-scope-every-read`});
    const hours=(Date.parse(session.end)-Date.parse(session.start))/3600000;
    if (session.eligibleTurnCount>config.staleSessionTurns && hours>config.staleSessionHours) flags.push({id:"stale-session",lever:"Lean context",severity:"warning",message:"A long-running session may contain stale task context.",evidence:`${session.source}|${session.sessionId}: ${session.eligibleTurnCount} turns over ${hours.toFixed(1)}h`,guideLink:`${guide}#2-start-fresh-when-the-task-changes`});
  }
  const short=Object.values(rollups.bySession).filter(x=>x.eligibleTurnCount<=config.shortSessionMaxTurns);
  if(short.length>=config.minShortSessions){const frontier=short.reduce((n,x)=>n+x.perTier.frontier,0),cheap=short.reduce((n,x)=>n+x.perTier.cheap,0),d=frontier+cheap;if(d>0&&frontier/d>config.heavyModelShare)flags.push({id:"heavy-model-routine",lever:"Cheaper defaults / routing",severity:"warning",message:"Short sessions rely heavily on frontier models.",evidence:`${short.length} short sessions; ${(frontier/d*100).toFixed(1)}% frontier share`,guideLink:`${guide}#5-tier-the-work`});}
  return flags;
}
