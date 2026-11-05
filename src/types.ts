export type GraveKind = "file" | "export" | "function" | "class" | "interface" | "type";

export interface Grave {
  /** What died */
  name: string;
  kind: GraveKind;
  /** Absolute path to the file where it was buried */
  filePath: string;
  /** 1-indexed line number of the declaration */
  line: number;
  /** Lines of code this grave occupies (approximate) */
  linesOfCode: number;
  /** Heuristic: was this likely born from an AI assistant? */
  likelyAiBorn: boolean;
  /** Reasons supporting the AI-born suspicion */
  aiEvidence: string[];
  /** How long since last reference (null = never referenced at all) */
  daysUnused: number | null;
  /** First-seen date from git, if available */
  bornAt: string | null;
}

export interface Graveyard {
  graves: Grave[];
  totalLinesOfCode: number;
  scannedFiles: number;
  scannedAt: string;
}

export interface BuryOptions {
  /** Delete the files/declarations */
  dryRun: boolean;
  /** Generate an obituary commit message */
  commitMessage: boolean;
}
