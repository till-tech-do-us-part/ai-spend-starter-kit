import { createReadStream } from "node:fs";
import { readdir, realpath } from "node:fs/promises";

export async function scan(root: string, accept: (path: string) => boolean): Promise<string[]> {
  const files: string[] = [], seen = new Set<string>();
  async function walk(dir: string): Promise<void> {
    let canonical: string; try { canonical = await realpath(dir); } catch { return; }
    if (seen.has(canonical)) return; seen.add(canonical);
    let entries; try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory() || entry.isSymbolicLink()) await walk(path);
      else if (entry.isFile() && accept(path)) files.push(path);
    }
  }
  await walk(root); return files.sort();
}
export async function lines(path: string, consume: (line: string) => void): Promise<void> {
  const input = createReadStream(path, { encoding: "utf8" });
  let pending = "";
  for await (const chunk of input) {
    pending += chunk;
    const parts = pending.split(/\r?\n/); pending = parts.pop() ?? "";
    for (const line of parts) consume(line);
  }
  if (pending) consume(pending);
}
