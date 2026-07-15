#!/usr/bin/env node
import { readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { readClaude, readCodex } from "./adapters/index.js";
import { aggregate, projectRollups } from "./aggregate.js";
import { analyze } from "./analyze.js";
import { loadConfig } from "./config.js";
import { renderHtml } from "./render/html.js";
import { renderTerminal } from "./render/terminal.js";
import type { Diagnostics, Source, UsageEvent } from "./types.js";

type Options={since:string;sources:Set<Source>;claudeDir:string;codexDir:string;explicitClaude:boolean;explicitCodex:boolean;project?:string;html?:string;json:boolean;config?:string};
function value(args:string[],i:number,flag:string):string{const v=args[i+1];if(!v||v.startsWith("--"))throw new Error(`${flag} requires a value`);return v;}
function parse(args:string[]):Options{const codexHome=process.env.CODEX_HOME;const o:Options={since:"7d",sources:new Set(["claude-code","codex"]),claudeDir:resolve(homedir(),".claude/projects"),codexDir:resolve(codexHome??homedir(),codexHome?"sessions":".codex/sessions"),explicitClaude:false,explicitCodex:false,json:false};for(let i=0;i<args.length;i++){const a=args[i]!;if(a==="--since")o.since=value(args,i++,a);else if(a==="--source"){o.sources=new Set(value(args,i++,a).split(",").map(s=>s==="claude"?"claude-code":s) as Source[]);if([...o.sources].some(s=>s!=="claude-code"&&s!=="codex"))throw new Error("--source must contain claude and/or codex");}else if(a==="--claude-dir"){o.claudeDir=resolve(value(args,i++,a));o.explicitClaude=true;}else if(a==="--codex-dir"){o.codexDir=resolve(value(args,i++,a));o.explicitCodex=true;}else if(a==="--project")o.project=value(args,i++,a);else if(a==="--html")o.html=resolve(value(args,i++,a));else if(a==="--config")o.config=resolve(value(args,i++,a));else if(a==="--json")o.json=true;else if(a==="--help"){process.stdout.write("token-usage-meter [--since 7d|30d|all] [--source claude,codex] [--claude-dir path] [--codex-dir path] [--project name] [--html path] [--json] [--config path]\n");process.exit(0);}else throw new Error(`unknown option: ${a}`);}return o;}
async function main():Promise<void>{const o=parse(process.argv.slice(2));const config=await loadConfig(o.config);const events:UsageEvent[]=[];const diagnostics={} as Diagnostics;for(const source of o.sources){const dir=source==="claude-code"?o.claudeDir:o.codexDir,explicit=source==="claude-code"?o.explicitClaude:o.explicitCodex;if(explicit)try{await readdir(dir);}catch{throw new Error(`unreadable explicit directory: ${dir}`);}const result=source==="claude-code"?await readClaude(dir):await readCodex(dir);events.push(...result.events);diagnostics[source]=result.diagnostic;if(!result.diagnostic.found||result.diagnostic.empty)process.stderr.write(`no ${source} logs found\n`);}const selected=o.project?events.filter(e=>e.project===o.project):events;const rollups=aggregate(selected,{since:o.since,config});const flags=analyze(rollups,config);const output={rollups:projectRollups(rollups),flags,diagnostics};if(o.html)await writeFile(o.html,renderHtml(rollups,flags),{encoding:"utf8",flag:"w"});process.stdout.write(o.json?`${JSON.stringify(output)}\n`:renderTerminal(rollups,flags));}
main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
