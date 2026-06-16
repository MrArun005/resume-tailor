#!/usr/bin/env node
// Scan the prepared application folders (applications/JOB-*) and write a
// manifest.json the web UI reads — one row per prepared application with its
// résumé/cover filenames, apply link, match, and status. Re-run after building
// more applications.
//
//   node manifest.mjs [--dir applications]

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[++i];
const DIR = args.dir || "applications";

const jobs = existsSync(`${DIR}/jobs.json`) ? JSON.parse(readFileSync(`${DIR}/jobs.json`, "utf8")) : [];
const status = existsSync(`${DIR}/status.json`) ? JSON.parse(readFileSync(`${DIR}/status.json`, "utf8")) : {};

const folders = readdirSync(DIR).filter((f) => /^JOB-\d+ - /.test(f) && statSync(join(DIR, f)).isDirectory());
const apps = [];

for (const folder of folders.sort()) {
  const path = join(DIR, folder);
  const files = readdirSync(path);
  const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
  const resume = pdfs.find((f) => !/cover/i.test(f));
  const cover = pdfs.find((f) => /cover/i.test(f));
  if (!resume) continue; // only list folders that actually have a built résumé

  // "JOB-001 - Company - Role"  →  code / company / role
  const parts = folder.split(" - ");
  const code = parts[0];
  const company = parts[1] || "";
  const role = parts.slice(2).join(" - ") || "";

  // Match a fetched job by company to pull the apply link + match/posted/salary.
  const job = jobs.find((j) => (j.company || "").toLowerCase().includes(company.toLowerCase()) || company.toLowerCase().includes((j.company || "").toLowerCase()));
  const st = status[code] || {};

  apps.push({
    code, folder, company,
    role: st.role || job?.title || role,
    applyUrl: job?.url || "",
    match: typeof job?.match === "number" ? job.match : (typeof st.match === "number" ? st.match : null),
    posted: (job?.posted || "").slice(0, 10) || "",
    salary: job?.salary || "",
    status: st.status || "saved",
    hasResume: !!resume,
    hasCover: !!cover,
    hasContent: files.includes("content.json"),
    hasPrep: files.includes("prep.md"),
    resumeFile: resume || "",
    coverFile: cover || "",
  });
}

apps.sort((a, b) => (b.match ?? -1) - (a.match ?? -1));
const manifest = { generatedAt: new Date().toISOString().slice(0, 10), count: apps.length, applications: apps };
writeFileSync(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${apps.length} prepared application(s) → ${resolve(`${DIR}/manifest.json`)}`);
for (const a of apps) console.log(`  ${a.code}  ${a.match != null ? a.match + "%" : "  "}  ${a.company} — ${a.status}${a.applyUrl ? "" : "  (no apply link)"}`);
