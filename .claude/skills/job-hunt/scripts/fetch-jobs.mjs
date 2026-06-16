#!/usr/bin/env node
// Fetch real job postings (with full descriptions) from FREE sources — no Apify,
// no paid proxies, no scraping of LinkedIn/Indeed. Merges several public APIs into
// one structured JSON list the job-hunt skill can tailor against.
//
//   node fetch-jobs.mjs --query "full stack AI engineer" [--location Bangalore]
//        [--days 1] [--limit 20] [--gh stripe,vercel] [--lever ramp,notion] [--out applications/jobs.json]
//
//   --days N : only postings from the last N days (1 = last 24h), newest first.
//              Adzuna filters server-side; other sources filter on their post date.
//              If --days is omitted and you're at a terminal, it ASKS interactively.
//   Smart widen: if a window returns too few jobs it auto-opens 1→3→7→14→any until
//              there are enough (--min N, default 8). Pass --exact to disable widening.
//              --no-prompt skips the interactive question (defaults to "any").
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
// Recency: --days N (1 = last 24h, 0 = any). When omitted we ask interactively
// (TTY) or default to "any". --exact disables the auto-widen ladder; --min N sets
// how many results count as "enough" before we stop widening.
let DAYS = args.days != null ? parseInt(args.days, 10) : null; // null = not specified yet
const EXACT = !!args.exact || !!args["no-widen"];
const NOPROMPT = !!args["no-prompt"];
const LIMIT = parseInt(args.limit || "20", 10);
const MIN = args.min != null ? parseInt(args.min, 10) : Math.min(8, LIMIT); // "enough" threshold for widening
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
// Pull an apply/contact email out of the JD text, if one is present. Skips
// noreply/system/asset addresses.
function extractEmail(text) {
  if (!text) return "";
  const all = String(text).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  const bad = /noreply|no-reply|donotreply|do-not-reply|example\.|sentry|adzuna|wixpress|\.(png|jpe?g|gif|svg)$/i;
  return all.find((e) => !bad.test(e)) || "";
}

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
    posted: j.publication_date || "",
  }));
}
async function remoteok() {
  const d = await getJSON("https://remoteok.com/api");
  return (Array.isArray(d) ? d : []).filter((j) => j && j.position).map((j) => ({
    title: j.position, company: j.company, location: j.location || "Remote",
    remote: true, url: j.url, description: htmlToText(j.description), source: "RemoteOK",
    posted: j.date || (j.epoch ? new Date(j.epoch * 1000).toISOString() : ""),
  }));
}
async function arbeitnow() {
  const d = await getJSON("https://www.arbeitnow.com/api/job-board-api");
  return (d.data || []).map((j) => ({
    title: j.title, company: j.company_name, location: j.location || "", remote: !!j.remote,
    url: j.url, description: htmlToText(j.description), source: "Arbeitnow",
    posted: j.created_at ? new Date(j.created_at * 1000).toISOString() : "",
  }));
}
async function greenhouse(token) {
  const d = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  return (d.jobs || []).map((j) => ({
    title: j.title, company: token, location: j.location?.name || "", remote: /remote/i.test(j.location?.name || ""),
    url: j.absolute_url, description: htmlToText(j.content), source: `Greenhouse:${token}`,
    posted: j.updated_at || "",
  }));
}
async function lever(token) {
  const d = await getJSON(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (Array.isArray(d) ? d : []).map((j) => ({
    title: j.text, company: token, location: j.categories?.location || "", remote: /remote/i.test(j.categories?.location || ""),
    url: j.hostedUrl, description: j.descriptionPlain || htmlToText(j.description), source: `Lever:${token}`,
    posted: j.createdAt ? new Date(j.createdAt).toISOString() : "",
  }));
}
async function adzuna(days) {
  const id = process.env.ADZUNA_APP_ID, key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const country = (args.country || "in").toString();
  const perPage = 50;
  const pages = Math.min(6, Math.ceil(Math.max(LIMIT, perPage) / perPage)); // up to 300 results
  let out = [];
  for (let p = 1; p <= pages; p++) {
    const u = `https://api.adzuna.com/v1/api/jobs/${country}/search/${p}?app_id=${id}&app_key=${key}`
      + `&what=${encodeURIComponent(QUERY)}${LOCATION ? `&where=${encodeURIComponent(LOCATION)}` : ""}`
      + `${days ? `&max_days_old=${days}&sort_by=date` : ""}&results_per_page=${perPage}&content-type=application/json`;
    try {
      const d = await getJSON(u);
      const items = (d.results || []).map((j) => ({
        title: j.title, company: j.company?.display_name || "", location: j.location?.display_name || "",
        remote: /remote/i.test(j.location?.display_name || ""), url: j.redirect_url, description: htmlToText(j.description), source: "Adzuna",
        posted: j.created || "",
      }));
      out = out.concat(items);
      if (items.length < perPage) break; // no more pages
    } catch { break; }
  }
  return out;
}

// Fetch the date-independent sources once (Adzuna is queried per-window since it
// can filter server-side). Cached so widening the window doesn't re-hit them.
let baseRaw = null;
const failed = [];
async function getBaseRaw() {
  if (baseRaw) return baseRaw;
  const tasks = [remotive(), remoteok(), arbeitnow()];
  for (const t of (args.gh ? String(args.gh).split(",") : [])) tasks.push(greenhouse(t.trim()));
  for (const t of (args.lever ? String(args.lever).split(",") : [])) tasks.push(lever(t.trim()));
  const settled = await Promise.allSettled(tasks);
  let all = [];
  for (const s of settled) {
    if (s.status === "fulfilled") all = all.concat(s.value);
    else failed.push(s.reason?.message || "error");
  }
  baseRaw = all;
  return all;
}

// Build the final job list for a given recency window (days; 0/null = any).
async function gather(days) {
  let adz;
  try { adz = await adzuna(days); } catch { adz = []; failed.push("Adzuna"); }
  const all = (await getBaseRaw()).concat(adz);
  const seen = new Set();
  let jobs = all
    .filter((j) => j.title && j.url && relevant(j.title) && locOk(j.location, j.remote))
    .filter((j) => {
      // Dedupe key ignores a trailing "(City)" so the same role across cities collapses to one.
      const k = `${j.title.replace(/\s*\([^)]*\)\s*$/, "").trim()}|${j.company}`.toLowerCase();
      if (seen.has(k)) return false; seen.add(k); return true;
    });
  if (days) {
    const cutoff = Date.now() - days * 864e5;
    jobs = jobs.filter((j) => j.posted && Date.parse(j.posted) >= cutoff);
  }
  // Sort: location matches first (not cut by the limit), then newest-first.
  const hit = (j) => (LOCATION && (j.location || "").toLowerCase().includes(LOCATION.toLowerCase()) ? 0 : 1);
  jobs.sort((a, b) => hit(a) - hit(b) || (Date.parse(b.posted || 0) || 0) - (Date.parse(a.posted || 0) || 0));
  return jobs.slice(0, LIMIT).map((j) => ({ ...j, email: extractEmail(j.description) }));
}

// --- Decide the recency window: ask (TTY) → smart auto-widen ladder. ---
const LADDER = [1, 3, 7, 14, 0]; // 0 = any (widest); rank() makes it sort last
const rank = (d) => (d === 0 || d == null ? Infinity : d);
const label = (d) => (d === 0 || d == null ? "any time" : d === 1 ? "last 24h" : `last ${d} days`);

if (DAYS == null && !NOPROMPT && process.stdin.isTTY) {
  const rl = (await import("node:readline/promises")).createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("How fresh should jobs be?  [1] 24h  [3] 3 days  [7] week  [0] any  (default 3): ")).trim();
  rl.close();
  DAYS = ans === "" ? 3 : parseInt(ans, 10);
  if (Number.isNaN(DAYS)) DAYS = 3;
}
if (DAYS == null) DAYS = 0; // non-interactive, unspecified → no filter

let jobs = await gather(DAYS);
let usedDays = DAYS;
// Smart widen: if too few results, open the window step by step until enough.
if (!EXACT && rank(DAYS) !== Infinity) {
  for (const d of LADDER.filter((x) => rank(x) > rank(DAYS)).sort((a, b) => rank(a) - rank(b))) {
    if (jobs.length >= MIN) break;
    console.log(`Only ${jobs.length} job(s) within ${label(usedDays)} — widening to ${label(d)}…`);
    jobs = await gather(d);
    usedDays = d;
  }
}

const { writeFileSync, mkdirSync } = await import("node:fs");
const { dirname, resolve } = await import("node:path");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(jobs, null, 2));

const withEmail = jobs.filter((j) => j.email).length;
console.log(`\nFetched ${jobs.length} jobs (${label(usedDays)}) → ${resolve(OUT)}  (${withEmail} include an apply email in the JD)`);
if (failed.length) console.log(`(sources that errored: ${failed.length} — others still returned results)`);
console.log("");
for (const j of jobs) console.log(`• ${(j.posted || "").slice(0, 10) || "  ?  "}  ${j.title} — ${j.company} — ${j.location || (j.remote ? "Remote" : "?")}  [${j.source.split(":")[0]}]`);
if (!process.env.ADZUNA_APP_ID) console.log("\nTip: set ADZUNA_APP_ID + ADZUNA_APP_KEY (free at developer.adzuna.com) for broad India/Bangalore coverage.");
