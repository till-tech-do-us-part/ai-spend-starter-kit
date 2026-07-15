import { readFile } from "node:fs/promises";

export type MeterConfig = {
  lowCacheHit: number; contextBloatMedianInput: number; staleSessionTurns: number; staleSessionHours: number;
  heavyModelShare: number; minShortSessions: number; shortSessionMaxTurns: number;
  modelTiers: { frontier: string[]; cheap: string[] };
};
export const defaults: MeterConfig = {
  lowCacheHit: .30, contextBloatMedianInput: 50000, staleSessionTurns: 12, staleSessionHours: 3,
  heavyModelShare: .70, minShortSessions: 5, shortSessionMaxTurns: 6,
  modelTiers: {
    cheap: ["haiku", "flash", "lite", "mini", "nano", "sonnet"],
    frontier: ["opus", "fable", "^gpt-5(\\.\\d+)?(-sol)?$", "gpt-5.*-(high|xhigh|max)", "gpt-5.*codex"]
  }
};
const keys = new Set([...Object.keys(defaults), "modelTiers"]);
export async function loadConfig(path?: string): Promise<MeterConfig> {
  if (!path) return structuredClone(defaults);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, "utf8")); } catch (error) { throw new Error(`config error: ${error instanceof Error ? error.message : String(error)}`); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("config error: expected an object");
  for (const key of Object.keys(raw)) if (!keys.has(key)) throw new Error(`config error: unknown key ${key}`);
  const result = structuredClone(defaults);
  const obj = raw as Record<string, unknown>;
  for (const key of ["lowCacheHit", "contextBloatMedianInput", "staleSessionTurns", "staleSessionHours", "heavyModelShare", "minShortSessions", "shortSessionMaxTurns"] as const) {
    if (obj[key] !== undefined) (result[key] as number) = obj[key] as number;
  }
  for (const key of ["lowCacheHit", "heavyModelShare"] as const) if (typeof result[key] !== "number" || result[key] < 0 || result[key] > 1) throw new Error(`config error: ${key} must be between 0 and 1`);
  for (const key of ["contextBloatMedianInput", "staleSessionTurns", "staleSessionHours", "minShortSessions", "shortSessionMaxTurns"] as const) if (!Number.isInteger(result[key]) || result[key] <= 0) throw new Error(`config error: ${key} must be a positive integer`);
  if (obj.modelTiers !== undefined) {
    const tiers = obj.modelTiers as Record<string, unknown>;
    if (!tiers || typeof tiers !== "object" || Array.isArray(tiers) || Object.keys(tiers).some(k => k !== "frontier" && k !== "cheap")) throw new Error("config error: invalid modelTiers");
    for (const tier of ["frontier", "cheap"] as const) if (tiers[tier] !== undefined) {
      if (!Array.isArray(tiers[tier]) || !(tiers[tier] as unknown[]).every(x => typeof x === "string")) throw new Error(`config error: modelTiers.${tier} must be strings`);
      result.modelTiers[tier] = [...tiers[tier] as string[]];
    }
  }
  try { for (const patterns of Object.values(result.modelTiers)) for (const pattern of patterns) new RegExp(pattern, "i"); } catch (error) { throw new Error(`config error: invalid regex: ${error instanceof Error ? error.message : String(error)}`); }
  return result;
}
export function tierFor(model: string, config: MeterConfig): "frontier" | "cheap" | "other" {
  if (config.modelTiers.cheap.some(p => new RegExp(p, "i").test(model))) return "cheap";
  if (config.modelTiers.frontier.some(p => new RegExp(p, "i").test(model))) return "frontier";
  return "other";
}
