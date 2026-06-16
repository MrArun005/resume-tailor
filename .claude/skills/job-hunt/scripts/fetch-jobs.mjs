#!/usr/bin/env node
// Fetch real job postings (with full descriptions) from FREE sources — no Apify,
// no paid proxies, no scraping of LinkedIn/Indeed. Merges several public APIs into
// one structured JSON list the job-hunt skill can tailor against.
//
//   node fetch-jobs.mjs --query "full stack AI engineer" [--location Bangalore]
//        [--limit 20] [--gh stripe,vercel] [--lever ramp,notion] [--out applications/jobs.json]
//
// Sources (all free):
//   • Remotive, RemoteOK, Arbeitnow      — no key, remote/startup heavy
//   • Greenhouse / Lever (--gh / --lever) — no key, per-company, full JD
//   • Adzuna (broad incl. India)          — set ADZUNA_APP_ID + ADZUNA_APP_KEY (free) to enable

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[i + 1]?.startsWith("--") || i + 1 >= process.argv.length ? true : process.argv[++i];
}
const QUERY = (args.query || "").toString();
const LOCATION = (args.location || "").toString();
const LIMIT = parseInt(args.limit || "20", 10);
const OUT = args.out || "applications/jobs.json";
const terms = QUERY.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

function htmlToText(s) {
  if (!s) return "";
  let t = String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&rdquo;|&ldquo;/g, '"').replace(/&nbsp;/g, " ");
  t = t.replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  return t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
// Match on the TITLE (precise) — avoids pulling "Office Assistant" just because a
// query word appears somewhere in the description.
function relevant(title) {
  if (!terms.length) return true;
  const t = (title || "").toLowerCase();
  return terms.some((term) => t.includes(term));
}
function locOk(location, remote) {
  if (!LOCATION) return true;
  if (remote) return true;
  return (location || "").toLowerCase().includes(LOCATION.toLowerCase());
}
async function getJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "job-hunt-skill", Accept: "application/json", ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(to);
  }
}

async function remotive() {
  const d = await getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(QUERY)}&limit=50`);
  return (d.jobs || []).map((j) => ({
    title: j.title, company: j.company_name, location: j.candidate_required_location || "Remote",
    remote: true, url: j.url, description: htmlToText(j.description), source: "Remotive",
  }));
}
async function remoteok() {
  const d = await getJSON("https://remoteok.com/api");
  return (Array.isArray(d) ? d : []).filter((j) => j && j.position).map((j) => ({
    title: j.position, company: j.company, location: j.location || "Remote",
    remote: true, url: j.url, description: htmlToText(j.description), source: "RemoteOK",
  }));
}
async function arbeitnow() {
  const d = await getJSON("https://www.arbeitnow.com/api/job-board-api");
  return (d.data || []).map((j) => ({
    title: j.title, company: j.company_name, location: j.location || "", remote: !!j.remote,
    url: j.url, description: htmlToText(j.description), source: "Arbeitnow",
  }));
}
async function greenhouse(token) {
  const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  return (d.jobs || []).map((j) => ({
    title: j.title, company: token, location: j.location?.name || "", remote: /remote/i.test(j.location?.name || ""),
    url: j.absolute_url, description: htmlToText(j.content), source: `Greenhouse:${token}`,
  }));
}
async function lever(token) {
  const d = await getJSON(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (Array.isArray(d) ? d : []).map((j) => ({
    title: j.text, company: token, location: j.categories?.location || "", remote: /remote/i.test(j.categories?.location || ""),
    url: j.hostedUrl, description: j.descriptionPlain || htmlToText(j.description), source: `Lever:${token}`,
  }));
}
async function adzuna() {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const country = (args.country || "in").toString();
  const u = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${id}&app_key=${key}`
    + `&what=${encodeURIComponent(QUERY)}${LOCATION ? `&where=${encodeURIComponent(LOCATION)}` : ""}&results_per_page=30&content-type=application/json`;
  const d = await getJSON(u);
  return (d.results || []).map((j) => ({
    title: j.title, company: j.company?.display_name || "", location: j.location?.display_name || "",
    remote: /remote/i.test(j.location?.display_name || ""), url: j.redirect_url, description: htmlToText(j.description), source: "Adzuna",
  }));
}

const tasks = [remotive(), remoteok(), arbeitnow(), adzuna()];
for (const t of (args.gh ? String(args.gh).split(",") : [])) tasks.push(greenhouse(t.trim()));
for (const t of (args.lever ? String(args.lever).split(",") : [])) tasks.push(lever(t.trim()));

const settled = await Promise.allSettled(tasks);
const used = [], failed = [];
let all = [];
for (const s of settled) {
  if (s.status === "fulfilled") { all = all.concat(s.value); if (s.value[0]?.source) used.push(s.value[0].source.split(":")[0]); }
  else failed.push(s.reason?.message || "error");
}

// filter (relevance + location), dedupe by title+company, cap to LIMIT
const seen = new Set();
const jobs = all
  .filter((j) => j.title && j.url && relevant(j.title) && locOk(j.location, j.remote))
  .filter((j) => {
    // Dedupe key ignores a trailing "(City)" so the same role across many cities collapses to one.
    const k = `${j.title.replace(/\s*\([^)]*\)\s*$/, "").trim()}|${j.company}`.toLowerCase();
    if (seen.has(k)) return false; seen.add(k); return true;
  })
  .slice(0, LIMIT);

const { writeFileSync, mkdirSync } = await import("node:fs");
const { dirname, resolve } = await import("node:path");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(jobs, null, 2));

console.log(`Fetched ${jobs.length} jobs → ${resolve(OUT)}`);
if (failed.length) console.log(`(sources that errored: ${failed.length} — others still returned results)`);
console.log("");
for (const j of jobs) console.log(`• ${j.title} — ${j.company} — ${j.location || (j.remote ? "Remote" : "?")}  [${j.source}]`);
if (!process.env.ADZUNA_APP_ID) console.log("\nTip: set ADZUNA_APP_ID + ADZUNA_APP_KEY (free at developer.adzuna.com) for broad India/Bangalore coverage.");
