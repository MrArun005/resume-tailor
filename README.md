# Tailorwright

A complete **job-hunting** tool. Point it at your résumé and either **one job** or
**tens of jobs**, and it will: find fresh postings, tailor a truthful, ATS-ready
résumé to each, render HTML/PDF, draft a ready-to-send email per role, and hand you
a single **where-to-apply map** — every line stays grounded in what you actually wrote.

![Tailorwright web app](docs/screenshots/app.png)

Two ways to use it:

- **Tailor one résumé** to one job — in your résumé's **own layout** or a clean
  ATS-friendly template (web app, CLI, or the `/job-hunt` skill).
- **Find & batch-apply** — fetch tens of real jobs from free sources (optionally only
  the **latest**, e.g. last 24h), tailor a résumé variant to each, generate cold-email
  drafts where a JD exposes an address, and track every application by a code.

It ships in **four forms** so anyone can use it:

| Form | For whom | How it tailors | Needs |
|---|---|---|---|
| **Web app** | Anyone with a browser | Calls Claude or Gemini server-side | An API key, a running server |
| **Claude Code Skill** (`/job-hunt`) | Anyone using Claude Code | Finds jobs + tailors in-session, single or batch | Just Claude Code — no API key |
| **Subagent** (`resume-tailor`) | Claude Code workflows | Wraps the skill | Just Claude Code |
| **Headless CLI** (`pnpm tailor`) | CI, cron, scripts | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` |

All four share one core: the prompts in [`lib/ai/prompts.ts`](lib/ai/prompts.ts) and
the deterministic template renderers in [`lib/templates/`](lib/templates/).

## Quickstart — the Claude Code skill (no API key, no server)

The fastest way to use Tailorwright. Install the `/job-hunt` skill globally,
then tailor any résumé entirely on your own machine:

```bash
# Install the job-hunt skill for Claude Code
git clone https://github.com/MrArun005/resume-tailor.git /tmp/resume-tailor \
  && cp -r /tmp/resume-tailor/.claude/skills/job-hunt ~/.claude/skills/ \
  && echo "Done — restart Claude Code, then type /job-hunt"
```

Restart Claude Code and type **`/job-hunt`** — point it at your résumé file and a
job description (plus an optional template or must-include highlights). Claude does the
tailoring **in-session**: no API key, no server, no third-party upload — your résumé
stays local. It renders a clean, ATS-friendly HTML/PDF you can send.

## Features

- **Two layout modes:** a faithful **mirror** of your original PDF's design, or one
  of three ATS-friendly templates — **Classic** (serif), **Modern** (sans + accent),
  **Compact** (dense). Switch instantly; export matches what you see.
- **Grounded tailoring:** the model never fabricates employers, titles, dates,
  degrees, or technologies — it reframes what's truthfully in your résumé.
- **Customization:** add must-include highlights (plain text); they're treated as
  true, candidate-supplied facts and woven into the right section.
- **Version history + diff:** every tailor run is saved (last 5); compare any two and
  see exactly what changed (added/removed lines, per section).
- **Consistent pagination:** 1.25cm margins on every page; long entries flow across
  page breaks instead of leaving gaps.
- **Exports:** PDF, Word (.docx), plain text, Markdown.

### Find & batch-apply (the `/job-hunt` skill)

- **Find real jobs, free:** merges **Adzuna** (broad, incl. India — free key) with
  **Remotive / RemoteOK / Arbeitnow** (no key) and any **Greenhouse / Lever / Ashby**
  company boards you name (full JDs, often listed *before* LinkedIn). No Apify, no paid
  proxies, no LinkedIn/Indeed scraping — everything within each source's terms.
- **Latest-only filter:** `--days N` keeps just the freshest postings (`--days 1` =
  last 24h), sorted newest-first, with a **Posted** date on every row.
- **Match score + ranking:** each job is scored 0–100 for profile↔JD fit and the list
  is ranked **best-fit first** (deterministic, no API; the skill refines it in-session).
- **Salary intelligence:** captures the posting's salary range where exposed.
- **One profile, many jobs:** interview once to capture true-but-off-résumé material,
  then tailor every job from that profile without re-interviewing.
- **Where-to-apply map:** a single `WHERE-TO-APPLY.md` mapping each role → match % →
  which résumé variant to send → apply link, with fit tag, salary, and post date.
- **Cover letter per job:** a short, truthful, JD-tailored letter rendered to a clean
  PDF that matches the résumé, attached alongside it in the draft.
- **Interview prep per job:** `prep.md` with likely questions (technical + behavioral,
  from the JD) and truthful answers drawn from your profile — gaps flagged, not faked.
- **Cold-email drafts:** for any role whose JD exposes an email, a ready `.eml`
  (résumé + cover letter attached) is generated — double-click, review, send. **Nothing auto-sends.**
- **Tracking dashboard:** each application gets a code (`JOB-001`, …) and a status
  lifecycle (saved → applied → interview → offer/rejected) in `DASHBOARD.md`, with
  follow-up reminders — update it with `track.mjs set JOB-003 applied`.

A résumé rendered into the **Modern** template:

![Modern template](docs/screenshots/template-modern.png)

## Web app

```bash
pnpm install
pnpm exec playwright install chromium   # for server-side PDF export
cp .env.example .env.local              # add ANTHROPIC_API_KEY and/or GEMINI_API_KEY
pnpm dev                                # http://localhost:3000
```

**Pipeline:**
1. `POST /api/analyze` — PDF → `{ content, templateHtml }` (layout reconstruction; the HTML is normalized to guarantee print margins).
2. `POST /api/tailor` — `{ content, templateHtml, jobDescription, customization }` → `{ tailoredContent, tailoredHtml, changes[] }`.
3. `POST /api/export` — `{ format, html | content }` → downloadable file. The PDF renderer blocks all network/`file://` loads (SSRF-safe).

## Claude Code Skill / Subagent

Installed under [`.claude/`](.claude/). In Claude Code, **`/job-hunt`** does both
single and batch — **Claude tailors in-session: no API key, no server, no third-party
service; your résumé stays local.**

- **Single job:** point it at a résumé file + a job description (+ optional
  template/highlights). It renders to HTML via
  [`scripts/render.mjs`](.claude/skills/job-hunt/scripts/render.mjs) (dependency-free)
  and PDF via [`scripts/topdf.mjs`](.claude/skills/job-hunt/scripts/topdf.mjs).
- **Batch ("find jobs and apply"):** it fetches real jobs, tailors a résumé variant to
  each, builds the where-to-apply map, and drafts cold emails. Fetch directly:

  ```bash
  cd .claude/skills/job-hunt
  # 1. find latest roles (Adzuna keys for India coverage; --ashby/--gh/--lever add company boards)
  ADZUNA_APP_ID=… ADZUNA_APP_KEY=… node scripts/fetch-jobs.mjs \
    --query "full stack engineer" --location Bangalore --country in --days 1 \
    --ashby notion,ramp --gh stripe --limit 80 --out applications/jobs.json
  node scripts/score-jobs.mjs     --jobs applications/jobs.json          # 2. match % + rank
  node scripts/build-applications.mjs --dir applications --name "Your Name"  # 3. where-to-apply map
  node scripts/track.mjs init     --dir applications                     # 4. seed the dashboard
  # later, as you apply / hear back:
  node scripts/track.mjs set JOB-003 applied --followup 2026-06-25
  ```

  `--days` is the recency filter (omit for all, `1` = last 24h, `3`/`7` for a fuller
  fresh batch). Output lands in `applications/` — open `WHERE-TO-APPLY.md` (ranked
  best-fit first) and `DASHBOARD.md` (status tracker).
- The `resume-tailor` subagent is a thin specialist that invokes the skill from
  larger workflows.

## CLI

```bash
export ANTHROPIC_API_KEY=...
pnpm tailor --resume me.pdf --jd job.txt --template modern \
  --custom "led a team of 6; AWS certified" --out tailored.html
```

Runs headless via `@anthropic-ai/sdk` (Claude Opus 4.8). Reuses the same prompts and
templates as the web app.

## Privacy & security

- **Your résumé is sent to the AI provider you configure** (web app / CLI). It is
  **not stored on any server** — only in your browser's `localStorage`, which the
  **Clear data** button wipes. The **Skill/Subagent** keep everything in the Claude
  Code session.
- ⚠️ The **free Gemini / AI Studio tier may use your data to train Google's models.**
  For private résumé data, use a paid Gemini API / Vertex tier or the Anthropic API
  (which doesn't train on API data). See [`.env.example`](.env.example).
- `DEBUG_AI=1` enables verbose model logging to disk — leave it unset in shared/deployed environments.

## Testing

```bash
pnpm test        # vitest — template renderers, HTML normalizer, résumé diff
```

## Troubleshooting

- **"No AI engine configured" / analyze fails (web app, CLI):** a key is missing or
  malformed. Anthropic keys start with `sk-ant-`; Google AI Studio keys start with
  `AIzaSy` (a value beginning `AQ.` is an OAuth token, not an API key). Fix
  `.env.local` and restart the dev server — `.env.local` is only read at startup.
- **PDF export errors locally:** run `pnpm exec playwright install chromium`.
- **The Skill doesn't appear in Claude Code:** ensure the folder lives at
  `.claude/skills/job-hunt/` in the project, or copy it to `~/.claude/skills/`
  for global use, then restart Claude Code.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · `@anthropic-ai/sdk` · `@google/genai`
· Playwright · html-to-docx · Vitest.

See [`SPEC.md`](./SPEC.md) and the design/plan docs under
[`docs/superpowers/`](docs/superpowers/) for the full design.
