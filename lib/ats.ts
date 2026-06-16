import type { ResumeContent } from "./content";

// Normalize for matching: lowercase, keep alphanumerics + a few skill-significant
// characters (. + # -) so "Node.js", "C++", "C#" survive, collapse whitespace.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Flatten a résumé's content into one searchable string.
export function resumeText(c: ResumeContent): string {
  const parts: string[] = [c.name, c.headline, ...c.contact];
  for (const s of c.sections) {
    parts.push(s.title);
    for (const b of s.blocks) {
      parts.push(b.heading, b.subheading, b.text, ...b.bullets);
    }
  }
  return parts.filter(Boolean).join(" \n ");
}

export interface Coverage {
  covered: string[];
  missing: string[];
  score: number; // percentage 0–100
  total: number;
}

// Deterministically score which JD keywords appear in the résumé text. The keyword
// list is produced semantically (by the model); this function is the honest,
// testable scorer. Matching is case-insensitive substring on normalized text.
export function coverage(keywords: string[], text: string): Coverage {
  const hay = norm(text);
  const covered: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const k of keywords) {
    const key = norm(k);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    (hay.includes(key) ? covered : missing).push(k);
  }
  const total = covered.length + missing.length;
  const score = total === 0 ? 0 : Math.round((covered.length / total) * 100);
  return { covered, missing, score, total };
}
