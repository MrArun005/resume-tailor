#!/usr/bin/env node
// AI Job Match Score + Semantic Ranking (deterministic, zero-dep, no API key).
// Reads jobs.json + the candidate's profile (the résumé source JSONs under
// resumes/.src/, or --profile <file>, or --skills "a,b,c"), scores how well each
// job fits the candidate (0–100), and writes `match` + `matchWhy` back into
// jobs.json, sorted best-fit first. This is the free baseline ranking; the
// /job-hunt skill (Claude) can refine the numbers in-session for nuance.
//
//   node score-jobs.mjs [--jobs applications/jobs.json] [--src applications/resumes/.src]
//                       [--profile path.json] [--skills "react,node,llm"]
//
// Score = 0.65·skillFit + 0.35·titleFit, times a seniority alignment factor.
//   skillFit  : how many of the candidate's skills the JD mentions (8+ ⇒ strong)
//   titleFit  : how on-target the job title is for the candidate's target roles
//   seniority : gentle penalty when the title sits well above/below ~4 yrs

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[++i];
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

const SKILLS = collectSkills();
if (!SKILLS.length) { console.error("No profile skills found — pass --skills or add résumé sources under", SRC); process.exit(1); }

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
for (const j of jobs) Object.assign(j, scoreJob(j));
// Rank best-fit first; tie-break by recency.
jobs.sort((a, b) => b.match - a.match || (Date.parse(b.posted || 0) || 0) - (Date.parse(a.posted || 0) || 0));
writeFileSync(JOBS, JSON.stringify(jobs, null, 2));

console.log(`Scored ${jobs.length} jobs against ${SKILLS.length} profile skills → ${resolve(JOBS)} (ranked best-fit first)\n`);
for (const j of jobs) console.log(`• ${String(j.match).padStart(3)}%  ${j.title} — ${j.company}${j.matchWhy?.length ? `   [${j.matchWhy.slice(0, 4).join(", ")}]` : ""}`);
