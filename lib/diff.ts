import type { ResumeContent, SectionSchema } from "./content";
import { z } from "zod";

type Section = z.infer<typeof SectionSchema>;

export type LineOp = "same" | "add" | "del";

export interface LineDiff {
  op: LineOp;
  text: string;
}

export interface SectionDiff {
  title: string;
  lines: LineDiff[];
  changed: boolean;
}

export interface ResumeDiff {
  sections: SectionDiff[];
  added: number;
  removed: number;
}

// Flatten a section into the ordered list of human-readable lines we diff on.
function sectionLines(s: Section): string[] {
  const out: string[] = [];
  for (const b of s.blocks) {
    const head = [b.heading, b.subheading].filter(Boolean).join(" — ");
    if (head) out.push(head);
    if (b.text) out.push(b.text);
    for (const bullet of b.bullets) out.push(`• ${bullet}`);
  }
  return out;
}

// Classic LCS line diff: aligns unchanged lines, marks the rest add/del.
function diffLines(a: string[], b: string[]): LineDiff[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: LineDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "del", text: a[i] });
      i++;
    } else {
      out.push({ op: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "del", text: a[i++] });
  while (j < m) out.push({ op: "add", text: b[j++] });
  return out;
}

// Deterministic line diff of two résumés, grouped by section. Sections are matched
// by title (in the target's order, then any base-only sections appended). A pure
// function — no AI, fully testable.
export function diffResume(base: ResumeContent, target: ResumeContent): ResumeDiff {
  const baseByTitle = new Map<string, Section>();
  for (const s of base.sections) if (!baseByTitle.has(s.title)) baseByTitle.set(s.title, s);

  const sections: SectionDiff[] = [];
  let added = 0;
  let removed = 0;

  const seen = new Set<string>();
  for (const t of target.sections) {
    seen.add(t.title);
    const b = baseByTitle.get(t.title);
    const lines = diffLines(b ? sectionLines(b) : [], sectionLines(t));
    const changed = lines.some((l) => l.op !== "same");
    added += lines.filter((l) => l.op === "add").length;
    removed += lines.filter((l) => l.op === "del").length;
    sections.push({ title: t.title, lines, changed });
  }

  // Sections that existed in the base but are gone from the target.
  for (const b of base.sections) {
    if (seen.has(b.title)) continue;
    const lines = diffLines(sectionLines(b), []);
    removed += lines.length;
    sections.push({ title: b.title, lines, changed: lines.length > 0 });
  }

  return { sections, added, removed };
}
