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

// Tiny stemmer so "pipelines"≈"pipeline", "crawling"≈"crawl", "services"≈"servic".
// Applied identically to both sides, so exact form doesn't matter for matching.
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  // Drop "es" only on real -es plurals (boxes, matches), not "pipelines".
  if (/(s|x|z|ch|sh)es$/.test(w) && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

function stemPhrase(s: string): string {
  return norm(s).split(" ").map(stem).join(" ");
}

// Concept aliases — the JD often words a requirement differently than a résumé does.
// Keyed by the normalized JD keyword; values are phrasings that should also count.
const ALIASES: Record<string, string[]> = {
  "cloud services": ["aws", "gcp", "azure", "cloud"],
  cloud: ["aws", "gcp", "azure"],
  "distributed systems": ["distributed microservices", "microservices"],
  "code review": ["reviewed code", "code reviews", "peer review"],
  "enterprise ai": ["ai saas", "llm", "ai/llm", "ai-powered"],
  "asynchronous jobs": ["background jobs", "queues", "async", "message queue"],
  "async jobs": ["background jobs", "queues", "asynchronous"],
  "background jobs": ["queues", "async", "asynchronous"],
  "production debugging": ["production bottlenecks", "resolved bottlenecks", "debugging"],
  "backend services": ["backend", "rest apis"],
  "data pipelines": ["data ingestion", "ingestion pipeline", "etl"],
  "ci/cd": ["jenkins", "continuous integration", "continuous delivery"],
};

// Index aliases by their stemmed key so singular/plural/verb forms of a JD keyword
// all resolve to the same alias list (e.g. "data pipeline" finds "data pipelines").
const STEM_ALIASES: Record<string, string[]> = {};
for (const [k, v] of Object.entries(ALIASES)) STEM_ALIASES[stemPhrase(k)] = v;

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

// Score which JD keywords are represented in the résumé. Matches by CONCEPT, not
// exact string: stemming collapses word forms and an alias map maps JD wording to
// résumé wording, so "code review" matches "reviewed code" and "cloud services"
// matches "AWS / GCP". The keyword list is produced semantically (by the model);
// this is the honest, deterministic, testable scorer.
export function coverage(keywords: string[], text: string): Coverage {
  const hay = stemPhrase(text);
  const covered: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const k of keywords) {
    const key = norm(k);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const skey = stemPhrase(key);
    const probes = [skey, ...(STEM_ALIASES[skey] ?? []).map(stemPhrase)].filter(Boolean);
    (probes.some((p) => hay.includes(p)) ? covered : missing).push(k);
  }
  const total = covered.length + missing.length;
  const score = total === 0 ? 0 : Math.round((covered.length / total) * 100);
  return { covered, missing, score, total };
}
