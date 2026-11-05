#!/usr/bin/env node
import { Command } from "commander";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanDeadCode, buryGraves } from "./gravedigger.js";
import { writeObituary, writeCommitMessage } from "./undertaker.js";
import { loadConfig, writeSampleConfig } from "./config.js";
import { renderCemeteryMap } from "./cemetery-map.js";
import type { Grave, Graveyard } from "./types.js";

const program = new Command();
program.name("code-cemetery").description("🪦 Dignified goodbyes for dead code.").version("0.2.0");

function scan(dirs: string[], ignore: string[]): Graveyard {
  const all: Grave[] = [];
  let scanned = 0;
  let loc = 0;
  for (const dir of dirs) {
    const yard = scanDeadCode(dir, ignore);
    all.push(...yard.graves);
    scanned += yard.scannedFiles;
    loc += yard.totalLinesOfCode;
  }
  // dedupe by file+name+line
  const seen = new Set<string>();
  const graves = all.filter((g) => {
    const key = `${g.filePath}::${g.name}::${g.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { graves, totalLinesOfCode: graves.reduce((a, g) => a + g.linesOfCode, 0), scannedFiles: scanned, scannedAt: new Date().toISOString() };
}

function printReport(yard: Graveyard): void {
  if (yard.graves.length === 0) {
    console.log("✨ No graves found. Your codebase is suspiciously alive.");
    return;
  }
  const aiCount = yard.graves.filter((g) => g.likelyAiBorn).length;
  console.log(`🪦  Graveyard Report — ${yard.graves.length} grave(s), ${yard.totalLinesOfCode} lines at rest (${aiCount} 🤖 likely AI-born)\n`);
  for (const grave of yard.graves) {
    console.log(`${grave.likelyAiBorn ? "🤖" : "🪦"}  ${grave.name} (${grave.kind})`);
    console.log(`    at ${grave.filePath}:${grave.line} · ~${grave.linesOfCode} LOC`);
    if (grave.likelyAiBorn) console.log(`    suspected AI-born: ${grave.aiEvidence.join("; ")}`);
    console.log();
  }
}

program
  .command("scan")
  .description("Walk the graveyard — list dead code without touching anything")
  .option("-d, --dir <path>", "directory to scan (overrides config)")
  .option("--json", "output as JSON")
  .action((opts: { dir?: string; json?: boolean }) => {
    const cfg = loadConfig();
    const dirs = opts.dir ? [opts.dir] : cfg.dirs;
    const yard = scan(dirs, cfg.ignore);
    if (opts.json) {
      console.log(JSON.stringify(yard, null, 2));
      return;
    }
    printReport(yard);
    console.log(`Scanned ${yard.scannedFiles} files at ${yard.scannedAt}`);
  });

program
  .command("bury")
  .description("Delete dead code and write an obituary commit")
  .option("-d, --dir <path>", "directory to scan (overrides config)")
  .option("--dry-run", "show obituaries without deleting")
  .option("--no-obituary", "skip printing obituaries to stdout")
  .action((opts: { dir?: string; dryRun?: boolean; obituary?: boolean }) => {
    const cfg = loadConfig();
    const dirs = opts.dir ? [opts.dir] : cfg.dirs;
    const yard = scan(dirs, cfg.ignore);
    if (yard.graves.length === 0) {
      console.log("✨ Nothing to bury. The cemetery is empty today.");
      return;
    }

    if (opts.dryRun) {
      for (const g of yard.graves) console.log(writeObituary(g), "\n");
      console.log("Dry run only — nothing deleted. Re-run without --dry-run to bury.");
      return;
    }

    const { filesDeleted, symbolsRemoved } = buryGraves(yard.graves, dirs[0] ?? "src");
    const msgPath = join(mkdtempSync(join(tmpdir(), "cemetery-")), "msg");
    writeFileSync(msgPath, writeCommitMessage(yard.graves));
    console.log(`⚰️  Burial complete: ${filesDeleted} file(s) deleted, ${symbolsRemoved} symbol(s) excised.`);
    console.log(`   Commit message: ${msgPath}`);
    console.log(`   Use: git commit -F ${msgPath}`);
    if (opts.obituary) for (const g of yard.graves) console.log(writeObituary(g), "\n");
  });

program
  .command("map")
  .description("Generate an HTML cemetery map of your dead code")
  .option("-d, --dir <path>", "directory to scan (overrides config)")
  .option("-o, --out <file>", "output HTML file", "cemetery.html")
  .action((opts: { dir?: string; out: string }) => {
    const cfg = loadConfig();
    const dirs = opts.dir ? [opts.dir] : cfg.dirs;
    const yard = scan(dirs, cfg.ignore);
    writeFileSync(opts.out, renderCemeteryMap(yard));
    console.log(`🗺️  Cemetery map written to ${opts.out} — ${yard.graves.length} graves.`);
    console.log(`   Open it: open ${opts.out}`);
  });

program
  .command("check")
  .description("CI mode — exit 1 if graves exist (gate your PRs)")
  .option("-d, --dir <path>", "directory to scan (overrides config)")
  .option("--max <n>", "maximum allowed graves", parseInt)
  .action((opts: { dir?: string; max?: number }) => {
    const cfg = loadConfig();
    const dirs = opts.dir ? [opts.dir] : cfg.dirs;
    const yard = scan(dirs, cfg.ignore);
    const limit = opts.max ?? 0;
    if (yard.graves.length > limit) {
      console.error(`🪦  CHECK FAILED: ${yard.graves.length} grave(s) exceed the allowed maximum of ${limit}.`);
      for (const g of yard.graves) console.error(`   - ${g.name} (${g.filePath}:${g.line})`);
      process.exitCode = 1;
    } else {
      console.log(`✅ Cemetery check passed: ${yard.graves.length} grave(s) (limit ${limit}).`);
    }
  });

program
  .command("init")
  .description("Write a .cemeteryrc.json config file")
  .action(() => writeSampleConfig());

program.parse(process.argv);
