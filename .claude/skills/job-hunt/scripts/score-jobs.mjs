#!/usr/bin/env node
// AI Job Match Score + Semantic Ranking (deterministic, zero-dep, no API key).
// Reads jobs.json + the candidate's profile (the résumé source JSONs under
// resumes/.src/, or --profile <file>, or --skills "a,b,c"), scores how well each
// job fits the candidate (0–100), and writes `match` + `matchWhy` back into
// jobs.json, sorted best-fit first. This is the free baseline ranking; the
// /job-hunt skill (Claude) can refine the numbers in-session for nuance.
//
//   node score-jobs.mjs [--jobs applications/jobs.json] [--src applications/resumes/.src]
//                       [--profile path.json] [--skills "react,node,llm"] [--semantic]
//
// Score = 0.65·skillFit + 0.35·titleFit, times a seniority alignment factor.
//   skillFit  : how many of the candidate's skills the JD mentions (8+ ⇒ strong)
//   titleFit  : how on-target the job title is for the candidate's target roles
//   seniority : gentle penalty when the title sits well above/below ~4 yrs
//
// --semantic : blend in TRUE semantic similarity using a local embedding model
//   (Xenova/all-MiniLM-L6-v2 via @xenova/transformers — free, offline, no API key;
//   model downloads once ~23MB). Catches fit that keyword overlap misses. If the
//   package isn't installed it warns and falls back to the keyword baseline.
//   Enable with:  npm i @xenova/transformers

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  // Boolean flag if the next token is another flag or absent (e.g. --semantic).
  const next = process.argv[i + 1];
  args[a.slice(2)] = next === undefined || next.startsWith("--") ? true : process.argv[++i];
}
const JOBS = args.jobs || "applications/jobs.json";
// Default the profile sources to <jobs-dir>/resumes/.src so any --jobs location works.
const SRC = args.src || `${dirname(JOBS)}/resumes/.src`;

const STOP = new Set("and or the a an of to in for with on at by as is are this that your our you we i strong using build built work years year experience etc using ability able team teams across into from will would role bengaluru bangalore india mysuru mysore remote present linkedin portfolio".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9.+# /-]+/g, " ").replace(/\s+/g, " ").trim();

// --- Build the candidate's skill set from the profile sources ---
function collectSkills() {
  const phrases = new Set();
  const add = (txt) => {
    for (const part of String(txt || "").split(/[,;/|]| and /i)) {
      const p = norm(part).replace(/\.+$/, "").trim();
      if (p && p.length >= 2 && p.length <= 28 && !STOP.has(p)) phrases.add(p);
    }
  };
  if (args.skills) { args.skills.split(",").forEach(add); return [...phrases]; }
  const files = args.profile ? [args.profile] : (existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith(".json")).map((f) => `${SRC}/${f}`) : []);
  for (const f of files) {
    let doc; try { doc = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    add(doc.headline);
    for (const sec of doc.sections || []) {
      const isSkills = /skill|technolog|stack/i.test(sec.title || "");
      // Harvest skills only from the SKILLS section + project tech subheadings
      // (the "·"-separated stack line), never the dated company subheadings —
      // those leak locations/dates into the skill set.
      for (const b of sec.blocks || []) {
        if (isSkills) { add(b.text); add(b.heading); }
        else if (/·/.test(b.subheading || "") && !/\d{4}|present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(b.subheading)) add(b.subheading);
      }
    }
  }
  return [...phrases];
}

// Profile as a list of distinct SENTENCES (headline + each bullet/text line). We
// match a JD against individual bullets (max-pool) rather than one averaged vector,
// which is far more discriminating — a JD that strongly matches any real part of the
// background scores high, instead of everything blurring to the mean.
function collectProfileSentences() {
  const out = [];
  const files = args.profile ? [args.profile] : (existsSync(SRC) ? readdirSync(SRC).filter((f) => f.endsWith(".json")).map((f) => `${SRC}/${f}`) : []);
  for (const f of files) {
    let doc; try { doc = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    if (doc.headline) out.push(doc.headline);
    for (const sec of doc.sections || [])
      for (const b of sec.blocks || []) {
        if (b.text) out.push(b.text);
        for (const bl of b.bullets || []) out.push(bl);
      }
  }
  const uniq = [...new Set(out.filter(Boolean))];
  return uniq.length ? uniq : (args.skills ? args.skills.split(",") : []);
}

const SKILLS = collectSkills();
if (!SKILLS.length) { console.error("No profile skills found — pass --skills or add résumé sources under", SRC); process.exit(1); }

// Optional local semantic similarity (sentence-level max-pool + mean-centering).
// Returns an array of scores aligned to `jobs`, or null if the embedding package
// isn't installed. For each job we take the mean of its top-3 cosine matches across
// the profile's sentences — robust to one lucky line, blind to irrelevant ones.
async function semanticSims(profileSentences, jobs) {
  if (!profileSentences.length) return null;
  let pipe;
  try {
    // Maintained package first, then the older one — whichever is installed.
    let tx;
    try { tx = await import("@huggingface/transformers"); }
    catch { tx = await import("@xenova/transformers"); }
    if (tx.env) tx.env.allowLocalModels = false;
    pipe = await tx.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  } catch { return null; }
  const embed = async (t) => Array.from((await pipe(String(t || "").slice(0, 2000) || "n/a", { pooling: "mean", normalize: true })).data);
  const pvs = []; for (const s of profileSentences) pvs.push(await embed(s));
  const jvs = []; for (const j of jobs) jvs.push(await embed(`${j.title}. ${j.description}`));
  // Mean-center across every vector and renormalize: strips the "generic English"
  // component so similarity reflects what's DISTINCTIVE, not the ~0.4 baseline.
  const dim = pvs[0].length, all = [...pvs, ...jvs], mean = new Array(dim).fill(0);
  for (const v of all) for (let i = 0; i < dim; i++) mean[i] += v[i] / all.length;
  const center = (v) => {
    let n = 0; const o = v.map((x, i) => x - mean[i]);
    for (const x of o) n += x * x; n = Math.sqrt(n) || 1;
    return o.map((x) => x / n);
  };
  const pc = pvs.map(center);
  return jvs.map((jv) => {
    const jc = center(jv);
    const sims = pc.map((p) => { let d = 0; for (let i = 0; i < dim; i++) d += p[i] * jc[i]; return d; }).sort((a, b) => b - a);
    const k = Math.min(3, sims.length);
    return sims.slice(0, k).reduce((s, x) => s + x, 0) / k; // mean of top-k bullet matches
  });
}

const STRONG_TITLE = /full[ -]?stack|software engineer|backend|back[ -]?end|frontend|front[ -]?end|\bai\b|\bml\b|node|react|next\.?js|typescript|platform|product engineer|founding/i;
const OK_TITLE = /engineer|developer|programmer|sde\b/i;
const ABOVE = /principal|staff|director|\bvp\b|head of|architect|lead\b|manager/i;
const BELOW = /intern|graduate|trainee|junior|\bjr\b|fresher/i;

function scoreJob(job) {
  const hay = " " + norm(`${job.title} ${job.description}`) + " ";
  const tokens = new Set(hay.split(" "));
  // Whole-word / whole-phrase match so short skills (ai, ci, go) don't match
  // inside other words ("position", "specifically", "graduate").
  const present = (s) => (s.includes(" ") ? hay.includes(" " + s + " ") : tokens.has(s));
  const hits = SKILLS.filter(present);
  const skillFit = Math.min(1, hits.length / 8); // 8+ matched skills ⇒ full credit
  const t = norm(job.title);
  const titleFit = STRONG_TITLE.test(t) ? 1 : OK_TITLE.test(t) ? 0.6 : 0.25;
  const seniority = ABOVE.test(t) ? 0.85 : BELOW.test(t) ? 0.65 : 1;
  const score = Math.round(100 * (0.65 * skillFit + 0.35 * titleFit) * seniority);
  // matchWhy: the most distinctive matched skills (longer/multi-word first)
  const why = hits.sort((a, b) => b.length - a.length).slice(0, 6);
  return { match: score, matchWhy: why };
}

const jobs = JSON.parse(readFileSync(JOBS, "utf8"));
for (const j of jobs) Object.assign(j, scoreJob(j)); // keyword baseline → match, matchWhy

let mode = "keyword";
if (args.semantic) {
  const sims = await semanticSims(collectProfileSentences(), jobs);
  if (sims) {
    mode = "semantic+keyword";
    jobs.forEach((j, i) => {
      // top-k centered cosine (~0.1 … 0.55) → 0–100, then blend 55/45 with keyword
      // (which anchors the absolute level so scores stay comparable across batches).
      const semPct = Math.max(0, Math.min(100, Math.round((sims[i] - 0.1) * 210)));
      j.semantic = semPct;
      j.match = Math.round(0.55 * semPct + 0.45 * j.match);
    });
  } else {
    console.error("(@xenova/transformers not installed — `npm i @xenova/transformers` to enable semantic scoring; using keyword baseline)\n");
  }
}

// Rank best-fit first; tie-break by recency.
jobs.sort((a, b) => b.match - a.match || (Date.parse(b.posted || 0) || 0) - (Date.parse(a.posted || 0) || 0));
writeFileSync(JOBS, JSON.stringify(jobs, null, 2));

console.log(`Scored ${jobs.length} jobs against ${SKILLS.length} profile skills [${mode}] → ${resolve(JOBS)} (ranked best-fit first)\n`);
for (const j of jobs) console.log(`• ${String(j.match).padStart(3)}%${j.semantic != null ? ` (sem ${j.semantic})` : ""}  ${j.title} — ${j.company}${j.matchWhy?.length ? `   [${j.matchWhy.slice(0, 4).join(", ")}]` : ""}`);
