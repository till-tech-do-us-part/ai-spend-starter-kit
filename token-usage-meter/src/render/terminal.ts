import type { Flag, Rollups } from "../types.js";
import { terminal } from "./escape.js";
const n=(value:number)=>value.toLocaleString("en-US");
export function renderTerminal(r: Rollups, flags: Flag[]): string {
  const ratio=r.summary.cacheHitRatio===null?"n/a":`${(r.summary.cacheHitRatio*100).toFixed(1)}%`;
  const rows=["Token usage meter",`Total tokens: ${n(r.summary.totalTokens)}  Cache hit: ${ratio}  Sessions: ${r.summary.sessionCount}`,`Range: ${r.summary.start??"no data"} - ${r.summary.end??"no data"}`,`Top project: ${terminal(r.summary.topProject??"n/a")}  Top model: ${terminal(r.summary.topModel??"n/a")}`,"","By day",...Object.entries(r.byDay).map(([k,v])=>`${terminal(k)}  ${n(v.totalTokens)}`),"","Flags",...(flags.length?flags.map(f=>`[${f.severity}] ${terminal(f.id)}: ${terminal(f.message)} (${terminal(f.evidence)})`):["No waste flags."])];
  return `${rows.join("\n")}\n`;
}
