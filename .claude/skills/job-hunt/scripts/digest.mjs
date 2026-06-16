#!/usr/bin/env node
// Render a fetched/scored jobs.json into a compact markdown digest — used by the
// daily GitHub Actions hunt (uploaded as an artifact) and handy locally too.
//
//   node digest.mjs --jobs jobs.json --out digest.md [--top 25] [--title "Daily jobs"]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[a.slice(2)] = next === undefined || next.startsWith("--") ? true : process.argv[++i];
}
const JOBS = args.jobs || "jobs.json";
const OUT = args.out || "digest.md";
const TOP = parseInt(args.top || "25", 10);
const jobs = JSON.parse(readFileSync(JOBS, "utf8")).slice(0, TOP);
const scored = jobs.some((j) => typeof j.match === "number");

const rows = jobs.map((j, i) => {
  const cells = [
    String(i + 1),
    ...(scored ? [typeof j.match === "number" ? `${j.match}%` : "—"] : []),
    (j.posted || "").slice(0, 10) || "—",
    (j.company || "").replace(/\|/g, " "),
    (j.title || "").replace(/\|/g, " "),
    (j.location || (j.remote ? "Remote" : "?")).replace(/\|/g, " "),
    j.salary || "—",
    `[apply](${j.url})`,
  ];
  return `| ${cells.join(" | ")} |`;
});
const header = ["#", ...(scored ? ["Match"] : []), "Posted", "Company", "Role", "Location", "Salary", "Link"];

const md = `# ${args.title || "Job digest"}

_${jobs.length} role(s)${scored ? ", ranked best-fit first" : ", newest first"}._

| ${header.join(" | ")} |
| ${header.map(() => "---").join(" | ")} |
${rows.join("\n")}
`;
writeFileSync(OUT, md);
console.log(`Digest (${jobs.length} roles) → ${resolve(OUT)}`);
