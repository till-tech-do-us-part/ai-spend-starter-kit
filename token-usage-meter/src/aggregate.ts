import { defaults, tierFor, type MeterConfig } from "./config.js";
import type { Bucket, Rollups, TokenSums, UsageEvent } from "./types.js";

const zero = (): Bucket => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, turnCount: 0 });
const dictionary = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;
const add = (bucket: Bucket, event: UsageEvent): void => { for (const k of ["inputTokens","outputTokens","cacheReadTokens","cacheCreationTokens"] as const) bucket[k] += event[k]; bucket.totalTokens += event.inputTokens + event.outputTokens + event.cacheReadTokens + event.cacheCreationTokens; bucket.turnCount++; };
const median = (values: number[]): number => { const v = [...values].sort((a,b)=>a-b), n=v.length; return n ? n%2 ? v[(n-1)/2]! : (v[n/2-1]!+v[n/2]!)/2 : 0; };
export function parseSince(value: string, now = new Date()): number | null {
  if (value === "all") return null;
  const match = /^(7|30)d$/.exec(value); if (!match) throw new Error("--since must be 7d, 30d, or all");
  return now.getTime() - Number(match[1]) * 24 * 60 * 60 * 1000;
}
export function aggregate(input: UsageEvent[], options: { since?: string; now?: Date; config?: MeterConfig } = {}): Rollups {
  const now = options.now ?? new Date(), cutoff = parseSince(options.since ?? "all", now), config = options.config ?? defaults;
  const events = input.filter(e => { const t=Date.parse(e.timestamp); return Number.isFinite(t) && t <= now.getTime() && (cutoff === null || t >= cutoff); });
  const byDay = dictionary<Bucket>(), byProject = dictionary<Bucket>(), byModel = dictionary<Bucket>();
  const sessions = new Map<string, UsageEvent[]>(); const total=zero();
  for (const event of events) {
    add(total,event); const day=new Date(event.timestamp).toISOString().slice(0,10);
    for (const [map,key] of [[byDay,day],[byProject,event.project],[byModel,event.model]] as const) add(map[key] ??= zero(),event);
    const key=`${event.source}|${event.sessionId}`; const list=sessions.get(key)??[]; list.push(event); sessions.set(key,list);
  }
  const bySession = dictionary<Rollups["bySession"][string]>();
  for (const [key,list] of sessions) {
    list.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)); const bucket=zero(); const perTier={frontier:0,cheap:0,other:0};
    for (const event of list) { add(bucket,event); perTier[tierFor(event.model,config)] += event.inputTokens+event.outputTokens+event.cacheReadTokens+event.cacheCreationTokens; }
    bySession[key]={...bucket,source:list[0]!.source,sessionId:list[0]!.sessionId,start:list[0]!.timestamp,end:list.at(-1)!.timestamp,eligibleTurnCount:list.length,medianTotalInputPerTurn:median(list.map(e=>e.inputTokens+e.cacheReadTokens)),perTier};
  }
  const ratio = total.inputTokens+total.cacheReadTokens ? total.cacheReadTokens/(total.inputTokens+total.cacheReadTokens) : null;
  const top=(map:Record<string,Bucket>)=>Object.entries(map).sort((a,b)=>b[1].totalTokens-a[1].totalTokens||a[0].localeCompare(b[0]))[0]?.[0]??null;
  return {summary:{inputTokens:total.inputTokens,outputTokens:total.outputTokens,cacheReadTokens:total.cacheReadTokens,cacheCreationTokens:total.cacheCreationTokens,totalTokens:total.totalTokens,cacheHitRatio:ratio,sessionCount:sessions.size,start:events.length?[...events].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))[0]!.timestamp:null,end:events.length?[...events].sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0]!.timestamp:null,topProject:top(byProject),topModel:top(byModel)},byDay,byProject,byModel,bySession};
}
export function projectRollups(rollups: Rollups): Rollups {
  const bucket = (b: Bucket): Bucket => ({ inputTokens:b.inputTokens,outputTokens:b.outputTokens,cacheReadTokens:b.cacheReadTokens,cacheCreationTokens:b.cacheCreationTokens,totalTokens:b.totalTokens,turnCount:b.turnCount });
  const map = (source: Record<string,Bucket>): Record<string,Bucket> => Object.fromEntries(Object.entries(source).map(([key,value])=>[key,bucket(value)]));
  return {
    summary:{inputTokens:rollups.summary.inputTokens,outputTokens:rollups.summary.outputTokens,cacheReadTokens:rollups.summary.cacheReadTokens,cacheCreationTokens:rollups.summary.cacheCreationTokens,totalTokens:rollups.summary.totalTokens,cacheHitRatio:rollups.summary.cacheHitRatio,sessionCount:rollups.summary.sessionCount,start:rollups.summary.start,end:rollups.summary.end,topProject:rollups.summary.topProject,topModel:rollups.summary.topModel},
    byDay:map(rollups.byDay),byProject:map(rollups.byProject),byModel:map(rollups.byModel),
    bySession:Object.fromEntries(Object.entries(rollups.bySession).map(([key,s])=>[key,{...bucket(s),source:s.source,sessionId:s.sessionId,start:s.start,end:s.end,eligibleTurnCount:s.eligibleTurnCount,medianTotalInputPerTurn:s.medianTotalInputPerTurn,perTier:{frontier:s.perTier.frontier,cheap:s.perTier.cheap,other:s.perTier.other}}]))
  };
}
