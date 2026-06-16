---
name: job-hunt
description: >-
  All-in-one résumé + job-application agent. Tailor a résumé to one job, OR batch:
  find tens of jobs, tailor a truthful résumé to each, and produce a ready-to-send
  email draft per job — each tracked by a code in an applications/ folder with an
  index. Use whenever the user wants to "tailor my résumé", "apply to this job",
  "find jobs and tailor my résumé to each", "batch apply", "draft applications",
  or hands over a résumé plus job link(s) / search criteria. Everything (tailoring,
  PDF, email draft, search, batch tracking) lives in this one skill.
---

# Job Hunt — one skill: find → tailor → draft, single or batch

Take a candidate's résumé and either ONE job or TENS of jobs, and for each produce
a truthful, ATS-ready tailored résumé (HTML + PDF) and a ready-to-send email draft —
each application tracked by a code in an `applications/` folder. Tailoring never
fabricates; the user always reviews and sends.

Bundled scripts (all dependency-light, no API key, run from this skill's directory):
- `scripts/fetch-jobs.mjs` — find real jobs from free sources (see Step 2)
- `scripts/score-jobs.mjs` — AI match score + best-fit ranking (see Step 2b)
- `scripts/render.mjs <content.json> <template> <out.html>` — content → styled HTML
- `scripts/topdf.mjs <in.html> <out.pdf>` — HTML → PDF (Playwright/Puppeteer, SSRF-safe)
- `scripts/mkdraft.mjs --to … --subject … --body-file … --attach … --out …` — `.eml` draft
- `scripts/build-applications.mjs` — bind jobs ↔ résumés ↔ links (see Step 5b)
- `scripts/track.mjs <init|set|board|list>` — application tracking dashboard (see Step 4)

## Step 1 — Build the master profile ONCE (interview once, apply to many)

Read the résumé into the structured shape below (transcribe verbatim — don't
summarize or invent):

```json
{ "name": "", "headline": "", "contact": [],
  "sections": [ { "title": "", "blocks": [ { "heading": "", "subheading": "", "text": "", "bullets": [] } ] } ] }
```

Then run the **gap-interview once** to capture true-but-off-résumé material: skim the
target role(s), list skills/experience the résumé doesn't show, and ask the candidate
which they genuinely have (even from side projects). Record confirmed extras as a
reusable list — the **master profile** = structured résumé + confirmed extras.

This happens a single time. You then tailor every job against this profile **without
re-interviewing per job**. Never add anything the candidate didn't confirm.

## Step 2 — Get the jobs

- **Single job:** a posting URL (use the browser engine — navigate + snapshot — to
  extract title, company, JD, and any apply/recruiter email) or pasted text.
- **Batch / "find jobs":** gather criteria (role, location/remote, seniority,
  must-haves; infer from the résumé when terse), then fetch from **free** sources
  with the bundled script (no Apify, no paid proxies, no LinkedIn/Indeed scraping):

  ```bash
  node scripts/fetch-jobs.mjs --query "full stack AI engineer" --location Bangalore \
    [--days 1] --limit 20 [--gh stripe,vercel] [--lever ramp,notion] --out applications/jobs.json
  ```

  **Recency is dynamic — ask, then auto-widen.** When the user wants "latest"/"today's"
  jobs, first **ask how fresh** they want it (24h / 3 days / week / any), then pass it
  as `--days N` (`--days 1` = last 24h), sorted newest-first. The script **auto-widens**
  a too-narrow window (1 → 3 → 7 → 14 → any) until there are enough results (`--min N`,
  default 8) and prints each widening step — so a "last 24h" request that only has 2
  hits quietly becomes a usable 3-day batch instead of coming back near-empty. Pass
  `--exact` to hold a strict window, `--no-prompt` to skip the question (run from a
  skill where you already asked the user). Every job carries a `posted` date, surfaced
  as a **Posted** column in WHERE-TO-APPLY.md.

  It merges **Remotive / RemoteOK / Arbeitnow** (no key; remote/startup-heavy),
  **Greenhouse / Lever** per company (`--gh`/`--lever`, no key, full JD — get tokens
  via a web search like `site:boards.greenhouse.io <role>`), and **Adzuna** (broad,
  incl. India — set `ADZUNA_APP_ID`+`ADZUNA_APP_KEY`, free). Output is a JSON array of
  `{ title, company, location, url, description, posted, email }`. Read it and tailor each.

  Note for the user: the no-key sources skew **remote/global**; for dense Bangalore/
  India coverage, add an Adzuna key or pass specific `--gh`/`--lever` company tokens.
  You may also still take a posting URL (browser fetch) or pasted JD directly.

Only use postings you actually found/were given — never invent jobs, JDs, or emails.
If a board blocks fetching or hides the JD, note it and ask the user to paste that one.

The fetcher also captures **salary** (where the source exposes it, e.g. Adzuna) and a
`posted` date on every job.

## Step 2b — Score, rank, and research (the "copilot" layer)

**Match score + ranking.** Run the scorer to rate each job's fit against the master
profile (0–100) and rank the list best-fit first:

```bash
node scripts/score-jobs.mjs --jobs applications/jobs.json
```

It reads the candidate's skills from the résumé sources in `resumes/.src/*.json` (or
pass `--skills "react,node,…"`), writes `match` + `matchWhy` into each job, and re-sorts
the file. This is the **deterministic, no-API baseline**. You (Claude) should then
**refine the top candidates in-session** — read each high-scoring JD against the profile
and adjust `match` where keyword overlap misses real semantic fit (e.g. an "AI-augmented
development" role that's a strong fit but doesn't name your exact stack). Keep edits
truthful; the score reflects fit, never inflates it.

**Company intelligence.** For the top-ranked jobs the user cares about, do a quick web
search per company (what they do, stack, stage, any recent news/funding) and write a
2–3 line brief into that job's `company` field (and its `job.md`). Only real, sourced
facts — never guess. Skip for low-ranked jobs to keep the batch cheap.

## Step 3 — Per job: tailor, render, draft, track

Create the workspace once: `applications/`. For each job assign a sequential
**tracking code** `JOB-001`, `JOB-002`, … and a folder:

```
applications/JOB-001 - <Company> - <Role>/
```

Inside each folder, do:

1. **`job.md`** — the code, company, role, link, apply email (or "none found"), and the JD.
2. **Tailor** the master profile to this JD (mirror its real language where true, lead
   with the most relevant experience, fold in only confirmed extras, never fabricate).
   Write the tailored content JSON to `content.json` in the folder.
3. **Render + PDF:**
   ```bash
   node scripts/render.mjs "applications/JOB-001 - <Company> - <Role>/content.json" modern \
     "applications/JOB-001 - <Company> - <Role>/<Candidate> - <Company> - <YYYY-MM-DD>.html"
   node scripts/topdf.mjs "<...>.html" "<...>.pdf"
   ```
   Keep it 1–2 pages; if it overflows, use `compact` or trim least-relevant content.
4. **Email draft** — write the application/cold email body to `email.txt`, then:
   ```bash
   node scripts/mkdraft.mjs --to "<apply email or omit>" \
     --subject "Application — <Role> — <Candidate>" \
     --body-file "applications/JOB-001 - <Company> - <Role>/email.txt" \
     --attach "applications/JOB-001 - <Company> - <Role>/<...>.pdf" \
     --out "applications/JOB-001 - <Company> - <Role>/draft.eml"
   ```
   If the job carries an `email` (the fetcher auto-extracts any apply address from
   the JD), pass it as `--to`. Otherwise omit `--to` (inserts a placeholder to fill on
   review — e.g. a recruiter email found on LinkedIn). Most postings apply via a form,
   so a missing email is normal, not a failure.
5. **`notes.md`** — 4–8 "what changed" notes + the ATS keyword coverage (match by
   concept, not exact wording).

**Cost discipline for big batches:** keep per-job work bounded — tailor from the
profile in one focused pass per job, don't re-derive the profile, and reuse the same
template across the batch. If the user gave a cap (e.g. "top 10"), respect it and say
what you skipped.

## Step 4 — Tracking dashboard (status lifecycle)

Don't hand-maintain a markdown table — use the tracker. Seed it from the scored jobs,
then update status as the user applies/hears back:

```bash
node scripts/track.mjs init                         # seed applications/status.json + DASHBOARD.md
node scripts/track.mjs set JOB-003 applied --followup 2026-06-25
node scripts/track.mjs set JOB-003 interview --note "recruiter call Tue"
node scripts/track.mjs board                         # re-render the dashboard
```

`init` is safe to re-run (preserves existing statuses, matched by link; adds only new
jobs). It writes **`applications/DASHBOARD.md`**: a summary count per stage, a
**follow-ups due** section, and every application sorted most-advanced-first
(offer → interview → applied → saved → closed) with Match %, salary, dates, and notes.
Lifecycle: **saved → applied → interview → offer | rejected | dropped**.

## Step 5b — Bind it all together (batch)

For a batch, after fetching jobs and rendering a few **résumé variants** into
`applications/resumes/` (e.g. an AI/full-stack one, a founding-engineer one, an
enterprise/systems one), run the binder:

```bash
node scripts/build-applications.mjs --dir applications --name "<Candidate Name>"
```

It reads `applications/jobs.json`, picks the best-fit résumé variant per job, and
writes **`applications/WHERE-TO-APPLY.md`** — a single map of *role → which résumé to
send → apply link* (with fit tag + any email). For every job whose JD exposed an
**email**, it generates a ready **cold-email `.eml`** in `applications/drafts/` with
the right résumé attached. Also write `applications/README.md` explaining the folder.

This is the bound deliverable: **search → résumé variants → where-to-apply map →
cold-email drafts**, all in one folder.

## Step 5 — Deliver (single job)

Report the absolute path of `applications/` and `INDEX.md`, and a quick summary
(how many tailored, coverage range). Tell the user: open each `JOB-NNN` folder, review
the résumé PDF and `draft.eml` (double-click → opens in the mail app with the résumé
attached), fill any placeholder recipient, and **Send**.

## Guardrails

- **Truth first** — only what's in the résumé or the candidate's confirmed extras.
- **Never sends** — this skill only prepares drafts; sending is always the user's action.
- **No invented jobs/links/emails** — list only real findings.
- **One profile, many jobs** — interview once; tailor each job from that profile.
