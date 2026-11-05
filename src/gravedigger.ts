import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { relative } from "node:path";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import type { Grave, Graveyard } from "./types.js";

/**
 * Heuristics for spotting AI-born code. AI assistants tend to:
 *  - emit "comprehensive" helpers nobody asked for (deepClone, assertNever)
 *  - add defensive stubs and error wrappers
 *  - produce well-named, verbose JSDoc on code nobody calls
 *  - generate sibling variants (fetchX, fetchXWithRetry, fetchXCached)
 * Signals, not proof — flagged as "likely", never asserted.
 */
const AI_NAME_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /^(deep|safe)?(Clone|Copy)$/, why: "generic util clone — a classic AI 'comprehensive helper'" },
  { re: /^assert(Never|Exhaustive)$/, why: "assertNever — AI loves emitting exhaustiveness checks unprompted" },
  { re: /(^|_)(notImplemented|placeholder|stub)$/i, why: "placeholder/stub naming — common in generated scaffolding" },
  { re: /^(handle|process)[A-Z]\w*(Error|Exception|Fallback)$/, why: "defensive error wrapper — frequent speculative AI pattern" },
  { re: /(WithRetry|AndCache|OrDefault)$/, why: "variant suffix — AI often generates siblings nobody imports" },
  { re: /^is[A-Z]\w*(Valid|Empty|Present|Defined)$/, why: "generic type-guard — AI emits these liberally" },
];

const AI_DOC_PHRASES = ["this function", "this utility", "note that", "in production", "you may want to", "example usage"];

function jsDocAIScore(doc: string | undefined): { score: number; evidence: string[] } {
  if (!doc) return { score: 0, evidence: [] };
  let score = 0;
  const evidence: string[] = [];
  for (const phrase of AI_DOC_PHRASES) {
    if (doc.toLowerCase().includes(phrase)) {
      score += 1;
      evidence.push(`JSDoc contains "${phrase}"`);
    }
  }
  if (doc.length > 300) {
    score += 1;
    evidence.push("suspiciously thorough JSDoc on unreferenced code");
  }
  return { score, evidence };
}

function loc(node: { getStartLineNumber: () => number; getEndLineNumber: () => number }): number {
  return node.getEndLineNumber() - node.getStartLineNumber() + 1;
}

/** Count real usages of each name: every identifier that is NOT a declaration name. */
function buildReferenceIndex(files: SourceFile[]): Map<string, number> {
  const refs = new Map<string, number>();
  for (const file of files) {
    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const parent = id.getParent();
      if (parent) {
        const declKinds = new Set([
          SyntaxKind.FunctionDeclaration,
          SyntaxKind.ClassDeclaration,
          SyntaxKind.MethodDeclaration,
          SyntaxKind.PropertySignature,
          SyntaxKind.PropertyDeclaration,
          SyntaxKind.VariableDeclaration,
          SyntaxKind.InterfaceDeclaration,
          SyntaxKind.TypeAliasDeclaration,
          SyntaxKind.EnumDeclaration,
          SyntaxKind.Parameter,
        ]);
        if (declKinds.has(parent.getKind())) {
          const nameNode = (parent as unknown as { getNameNode?: () => unknown }).getNameNode?.();
          if (nameNode === id) continue; // it's a declaration, not a usage
        }
      }
      const text = id.getText();
      refs.set(text, (refs.get(text) ?? 0) + 1);
    }
  }
  return refs;
}

function gitFirstCommitDate(filePath: string): string | null {
  if (!existsSync(".git")) return null;
  try {
    const out = execSync(
      `git log --follow --diff-filter=A --format=%aI -n 1 -- "${filePath}"`,
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

interface Declarable {
  getName(): string | undefined;
  isExported(): boolean;
  getStartLineNumber(): number;
  getEndLineNumber(): number;
  getJsDocs(): { getText(): string }[];
}

function classify(name: string, node: Declarable, rel: string, refs: Map<string, number>): Grave | null {
  if (!name) return null;
  if ((refs.get(name) ?? 0) > 0) return null; // referenced somewhere — alive

  const doc = node.getJsDocs().map((d) => d.getText()).join("\n");
  const ai = jsDocAIScore(doc);
  const aiEvidence = [...ai.evidence];
  let aiScore = ai.score;
  for (const p of AI_NAME_PATTERNS) {
    if (p.re.test(name)) {
      aiScore += 2;
      aiEvidence.push(p.why);
    }
  }

  const kindMap: Record<string, Grave["kind"]> = {
    FunctionDeclaration: "function",
    ClassDeclaration: "class",
    InterfaceDeclaration: "interface",
    TypeAliasDeclaration: "type",
  };
  const kind = kindMap[node.constructor.name] ?? "export";

  return {
    name,
    kind,
    filePath: rel,
    line: node.getStartLineNumber(),
    linesOfCode: loc(node),
    likelyAiBorn: aiScore >= 2,
    aiEvidence,
    daysUnused: null,
    bornAt: gitFirstCommitDate(rel),
  };
}

/** Names that must never be buried (entry conventions, lifecycle hooks). */
const SACRED_NAMES = new Set(["main", "handler", "default", "register", "install", "setup", "config", "index"]);

export function scanDeadCode(rootDir: string, ignores: string[] = []): Graveyard {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    `${rootDir}/**/*.ts`,
    `${rootDir}/**/*.tsx`,
    `${rootDir}/**/*.js`,
    `${rootDir}/**/*.jsx`,
  ]);
  project.addSourceFilesAtPaths(["tsconfig.json"]);

  const files = project
    .getSourceFiles()
    .filter(
      (f) =>
        !/[\\/]?(node_modules|dist|build|\.git|coverage)[\\/]/.test(f.getFilePath()) &&
        !ignores.some((ig) => relative(process.cwd(), f.getFilePath()).includes(ig)),
    );

  const refs = buildReferenceIndex(files);
  const importedModules = new Set<string>();

  for (const file of files) {
    for (const decl of file.getImportDeclarations()) {
      importedModules.add(decl.getModuleSpecifierValue());
    }
    // re-exports count as usage of the source
    for (const decl of file.getExportDeclarations()) {
      const spec = decl.getModuleSpecifierValue();
      if (spec) importedModules.add(spec);
    }
  }

  const graves: Grave[] = [];
  const deadFiles = new Set<string>();

  for (const file of files) {
    const rel = relative(process.cwd(), file.getFilePath());
    const isEntry =
      /(^|\/)(index|main|app|cli|server|worker)\.(ts|tsx|js|mjs|cjs)$/.test(rel) ||
      /\.(config|d)\.(ts|js)$/.test(rel) ||
      /(^|\/)\.cemeteryrc/.test(rel);

    // ---- exported symbols that nobody references
    if (!isEntry) {
      const groups: Declarable[][] = [
        file.getFunctions() as unknown as Declarable[],
        file.getClasses() as unknown as Declarable[],
        file.getInterfaces() as unknown as Declarable[],
        file.getTypeAliases() as unknown as Declarable[],
      ];
      for (const group of groups) {
        for (const node of group) {
          const grave = classify(node.getName() ?? "", node, rel, refs);
          if (grave && !SACRED_NAMES.has(grave.name.toLowerCase())) {
            graves.push(grave);
            deadFiles.add(rel);
          }
        }
      }
    }

    // ---- whole files nobody imports (entry points & side-effectful files excluded)
    const stripExt = (p: string) => p.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
    const relNoExt = stripExt(rel.replace(/^(src\/)?/, ""));
    const wasImported = [...importedModules].some((spec) => {
      const base = stripExt(spec.replace(/^\.\//, "").replace(/^(src\/)?/, ""));
      return relNoExt.endsWith(base) || base.endsWith(relNoExt);
    });
    if (!isEntry && !wasImported) {
      const hasSideEffects = file
        .getStatements()
        .some((s) => ![SyntaxKind.ImportDeclaration, SyntaxKind.ExportDeclaration, SyntaxKind.TypeAliasDeclaration, SyntaxKind.InterfaceDeclaration].includes(s.getKind()));
      if (!hasSideEffects) {
        graves.push({
          name: rel,
          kind: "file",
          filePath: rel,
          line: 1,
          linesOfCode: file.getEndLineNumber(),
          likelyAiBorn: false,
          aiEvidence: [],
          daysUnused: null,
          bornAt: gitFirstCommitDate(rel),
        });
      }
    }
  }

  // De-duplicate: file graves supersede symbol graves inside them.
  const fileGravePaths = new Set(graves.filter((g) => g.kind === "file").map((g) => g.filePath));
  const final = graves.filter((g) => g.kind === "file" || !fileGravePaths.has(g.filePath));

  return {
    graves: final,
    totalLinesOfCode: final.reduce((a, g) => a + g.linesOfCode, 0),
    scannedFiles: files.length,
    scannedAt: new Date().toISOString(),
  };
}

/** Physically bury: delete dead files, excise dead declarations. */
export function buryGraves(graves: Grave[], rootDir: string): { filesDeleted: number; symbolsRemoved: number } {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    `${rootDir}/**/*.ts`,
    `${rootDir}/**/*.tsx`,
    `${rootDir}/**/*.js`,
    `${rootDir}/**/*.jsx`,
  ]);
  const files = project
    .getSourceFiles()
    .filter((f) => !/[\\/]?(node_modules|dist|build|\.git)[\\/]/.test(f.getFilePath()));

  let filesDeleted = 0;
  let symbolsRemoved = 0;

  for (const g of graves.filter((x) => x.kind === "file")) {
    try {
      rmSyncSafe(g.filePath);
      filesDeleted++;
    } catch (err) {
      console.error(`Could not bury file ${g.filePath}: ${(err as Error).message}`);
    }
  }

  const byFile = new Map<string, Grave[]>();
  for (const g of graves.filter((x) => x.kind !== "file")) {
    const list = byFile.get(g.filePath) ?? [];
    list.push(g);
    byFile.set(g.filePath, list);
  }

  for (const [rel, gvs] of byFile) {
    const file = files.find((f) => f.getFilePath().endsWith(rel));
    if (!file) continue;
    // remove deepest-first so line numbers stay valid
    for (const g of gvs.sort((a, b) => b.line - a.line)) {
      const lines = file.getText().split("\n");
      // re-scan this file for the named declaration
      let removed = false;
      for (const fn of [...file.getFunctions(), ...file.getClasses(), ...file.getInterfaces(), ...file.getTypeAliases()]) {
        if (fn.getName() === g.name && fn.getStartLineNumber() === g.line) {
          lines.splice(fn.getStartLineNumber() - 1, fn.getEndLineNumber() - fn.getStartLineNumber() + 1);
          file.replaceWithText(lines.join("\n"));
          removed = true;
          symbolsRemoved++;
          break;
        }
      }
      if (!removed) console.error(`  ⚠️  could not locate ${g.name} at ${rel}:${g.line} — left in peace`);
    }
    try {
      file.saveSync();
    } catch (err) {
      console.error(`Could not save ${rel}: ${(err as Error).message}`);
    }
  }
  return { filesDeleted, symbolsRemoved };
}

import { rmSync } from "node:fs";
function rmSyncSafe(p: string): void {
  rmSync(p, { force: true });
}
