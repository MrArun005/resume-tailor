#!/usr/bin/env node
// Application Tracking Dashboard (file-based, zero-dep, no API key).
// Maintains applications/status.json (one entry per job, keyed by tracking code)
// with a real status lifecycle + dates + follow-up reminders, and renders a
// human-readable applications/DASHBOARD.md.
//
//   node track.mjs init   [--jobs applications/jobs.json] [--dir applications]
//   node track.mjs set JOB-003 applied [--note "referred by X"] [--followup 2026-06-25]
//   node track.mjs board  [--dir applications]
//   node track.mjs list   [--status applied]            # quick console view
//
// Statuses: saved → applied → interview → offer | rejected | dropped
// `init` is safe to re-run: it preserves existing statuses/dates (matched by link)
// and only adds newly-fetched jobs.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = {};
const pos = [];
for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || i + 1 >= argv.length ? true : argv[++i];
  else pos.push(argv[i]);
}
const DIR = args.dir || "applications";
const STORE = `${DIR}/status.json`;
const STATUSES = ["saved", "applied", "interview", "offer", "rejected", "dropped"];
const ACTIVE = new Set(["saved", "applied", "interview"]);
const today = () => new Date().toISOString().slice(0, 10);

const load = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {});
const save = (s) => { mkdirSync(DIR, { recursive: true }); writeFileSync(STORE, JSON.stringify(s, null, 2)); };

function renderBoard(store) {
  const entries = Object.entries(store).map(([code, e]) => ({ code, ...e }));
  const counts = STATUSES.map((s) => `${s}: ${entries.filter((e) => e.status === s).length}`).join(" · ");
  const due = entries
    .filter((e) => e.followUp && e.followUp <= today() && ACTIVE.has(e.status))
    .sort((a, b) => a.followUp.localeCompare(b.followUp));

  // Surface the most-advanced/active first; closed (rejected/dropped) at the bottom.
  const DISPLAY = ["offer", "interview", "applied", "saved", "rejected", "dropped"];
  const order = (s) => { const i = DISPLAY.indexOf(s); return i === -1 ? DISPLAY.length : i; };
  entries.sort((a, b) => order(a.status) - order(b.status) || (b.match || 0) - (a.match || 0));

  const rows = entries.map((e) => {
    const last = Object.entries(e.dates || {}).sort((a, b) => (b[1] || "").localeCompare(a[1] || "") || STATUSES.indexOf(b[0]) - STATUSES.indexOf(a[0]))[0];
    const when = last ? `${last[0]} ${last[1]}` : "—";
    return `| ${e.code} | ${e.match != null ? e.match + "%" : "—"} | ${e.company || ""} | ${(e.role || "").replace(/\|/g, " ")} | **${e.status}** | ${when} | ${e.followUp || "—"} | ${e.salary || "—"} | ${e.note ? e.note.replace(/\|/g, " ") : ""} |`;
  });

  const md = `# Application dashboard

_Updated ${today()}._  **${entries.length} tracked** — ${counts}

${due.length ? `## ⏰ Follow-ups due\n${due.map((e) => `- **${e.code}** ${e.company} — _${e.role}_ (since ${e.followUp}; status: ${e.status})`).join("\n")}\n` : "_No follow-ups due._\n"}
## All applications

| Code | Match | Company | Role | Status | Last update | Follow-up | Salary | Note |
|------|-------|---------|------|--------|-------------|-----------|--------|------|
${rows.join("\n")}

---
Update status: \`node scripts/track.mjs set ${entries[0]?.code || "JOB-001"} applied --followup ${today()}\`
Lifecycle: saved → applied → interview → offer | rejected | dropped
`;
  writeFileSync(`${DIR}/DASHBOARD.md`, md);
  return { n: entries.length, counts, due: due.length };
}

if (cmd === "init") {
  const jobsPath = args.jobs || `${DIR}/jobs.json`;
  const jobs = JSON.parse(readFileSync(jobsPath, "utf8"));
  const store = load();
  const byLink = new Map(Object.entries(store).map(([code, e]) => [e.link, code]));
  let maxN = Object.keys(store).reduce((m, c) => Math.max(m, parseInt(c.replace(/\D/g, ""), 10) || 0), 0);
  let added = 0;
  for (const j of jobs) {
    const fresh = { company: j.company, role: j.title, link: j.url, match: j.match, salary: j.salary || "" };
    const existing = byLink.get(j.url);
    if (existing) { Object.assign(store[existing], fresh); continue; } // preserve status/dates/note
    const code = `JOB-${String(++maxN).padStart(3, "0")}`;
    store[code] = { ...fresh, status: "saved", dates: { saved: today() }, followUp: "", note: "" };
    added++;
  }
  save(store);
  const r = renderBoard(store);
  console.log(`Tracked ${r.n} application(s) (${added} new) → ${resolve(`${DIR}/DASHBOARD.md`)}\n${r.counts}`);
} else if (cmd === "set") {
  const code = (pos[0] || "").toUpperCase();
  const status = (pos[1] || "").toLowerCase();
  const store = load();
  if (!store[code]) { console.error(`Unknown code ${code}. Known: ${Object.keys(store).join(", ") || "(none — run init first)"}`); process.exit(1); }
  if (status && !STATUSES.includes(status)) { console.error(`Invalid status "${status}". Use: ${STATUSES.join(", ")}`); process.exit(1); }
  const e = store[code];
  if (status) { e.status = status; e.dates = e.dates || {}; if (!e.dates[status]) e.dates[status] = today(); }
  if (typeof args.note === "string") e.note = args.note;
  if (typeof args.followup === "string") e.followUp = args.followup;
  save(store);
  renderBoard(store);
  console.log(`${code} → ${e.status}${e.followUp ? ` (follow-up ${e.followUp})` : ""}. Dashboard updated.`);
} else if (cmd === "board") {
  const r = renderBoard(load());
  console.log(`Dashboard → ${resolve(`${DIR}/DASHBOARD.md`)}  (${r.n} tracked, ${r.due} follow-up(s) due)`);
} else if (cmd === "list") {
  const store = load();
  const entries = Object.entries(store).filter(([, e]) => !args.status || e.status === args.status);
  for (const [code, e] of entries) console.log(`${code}  ${(e.status || "").padEnd(9)} ${e.match != null ? (e.match + "%").padStart(4) : "  —"}  ${e.company} — ${e.role}`);
  if (!entries.length) console.log("(nothing tracked yet — run: node scripts/track.mjs init)");
} else {
  console.log("Usage: track.mjs <init|set|board|list> …\n  init  [--jobs jobs.json] [--dir applications]\n  set JOB-003 applied [--note \"…\"] [--followup YYYY-MM-DD]\n  board\n  list [--status applied]");
  process.exit(cmd ? 1 : 0);
}
