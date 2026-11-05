import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CemeteryConfig {
  /** Directories to scan (default: ["src"]) */
  dirs: string[];
  /** Glob fragments to ignore */
  ignore: string[];
  /** Sacred names that must never be buried */
  sacred: string[];
}

const DEFAULTS: CemeteryConfig = {
  dirs: ["src"],
  ignore: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/generated/**", "**/__generated__/**"],
  sacred: ["main", "handler", "index"],
};

export function loadConfig(): CemeteryConfig {
  const candidates = [".cemeteryrc.json", ".cemeteryrc", "cemetery.config.json"];
  for (const name of candidates) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<CemeteryConfig>;
        return {
          dirs: raw.dirs ?? DEFAULTS.dirs,
          ignore: [...DEFAULTS.ignore, ...(raw.ignore ?? [])],
          sacred: [...DEFAULTS.sacred, ...(raw.sacred ?? [])],
        };
      } catch {
        console.error(`⚠️  Could not parse ${name} — using defaults`);
      }
    }
  }
  return DEFAULTS;
}

export function writeSampleConfig(): void {
  const p = join(process.cwd(), ".cemeteryrc.json");
  writeText(
    p,
    JSON.stringify(
      {
        dirs: ["src"],
        ignore: ["**/generated/**", "**/vendor/**"],
        sacred: ["main", "handler"],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Written: ${p}`);
}

import { writeFileSync } from "node:fs";
function writeText(p: string, content: string): void {
  writeFileSync(p, content);
}
