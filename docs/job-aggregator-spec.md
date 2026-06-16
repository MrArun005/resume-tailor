# Job Aggregation Engine — vision spec + feasibility

> Saved 2026-06-16. This is a **future-vision** spec for a large-scale job
> aggregation platform (Simplify/Wellfound-style). Today's `job-hunt` skill
> (`scripts/fetch-jobs.mjs`) already implements a lean slice of it (ATS + free APIs).
> Feasibility assessment is at the bottom.

## Sources (from the brief)

**ATS (best — structured, mostly free public feeds):** Greenhouse, Lever, Ashby,
SmartRecruiters, Workday, Teamtailor, Recruitee, BambooHR, Jobvite, iCIMS, BreezyHR,
Comeet, JazzHR, Personio, Rippling, SAP SuccessFactors, Oracle Taleo, Zoho Recruit,
Workable, Pinpoint, Crelate, Fountain, Homerun, JobScore.

**Startup boards:** YC Jobs, Wellfound (AngelList), Otta, Hired, Cord, Getro, Untapped.

**Remote boards:** RemoteOK, We Work Remotely, Remotive, Jobspresso, Himalayas, Arc,
FlexJobs, Dynamite Jobs.

**General boards:** LinkedIn, Indeed, Naukri, Monster, Foundit, Shine, Glassdoor,
ZipRecruiter, Dice, CareerBuilder, SimplyHired, Jooble.

**Government:** USAJobs, European Job Days, state portals, Indian govt portals.

**Company career pages, GitHub, Discord/Slack/Reddit/Telegram/Facebook/X, Google Jobs,
newsletters.**

**Open APIs:** Adzuna, Arbeitnow, Remotive, USAJobs, Open Startup Jobs.

## Target architecture (from the brief)

Scheduler → [ATS APIs · Scrapers · Open APIs · Search-engine indexing] → Normalize →
Dedupe → AI description cleaner → Embeddings → Postgres/Mongo → Elasticsearch/Typesense
→ Node API → Next.js/Flutter frontend.

**Stack:** Next.js + Tailwind · Node/Express · PostgreSQL + Redis · Typesense/Elastic ·
BullMQ + Redis queue · Cron scheduler · Prisma · JWT + Google OAuth · Docker + Nginx.

**Features:** modular connectors; common normalized schema; fuzzy/embedding dedup;
semantic search + filters; bookmarking + application tracking + recommendations;
periodic refresh + expiry; REST APIs; admin dashboard for connector health; Docker
Compose, migrations, tests, logging, retries, rate limiting; clean architecture.

**Stated guardrail (correct):** *Do not rely on scraping sites that prohibit automated
access. Prefer official APIs, public feeds, or employer career pages; respect
robots.txt, rate limits, and ToS.*

---

## Feasibility (honest assessment)

The architecture is **sound and standard** — this is genuinely how Simplify/Wellfound
work. It's buildable, but it's a **product/company-scale effort**, not a skill feature.
Broken down:

### 🟢 Easy / already partly done (free, low maintenance)
- **ATS public APIs:** Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee
  — clean JSON, no key, no ToS issue. (Greenhouse + Lever already in `fetch-jobs.mjs`.)
- **Free job APIs:** Adzuna, Arbeitnow, Remotive, RemoteOK, USAJobs, We Work Remotely
  (RSS), Hacker News "Who's Hiring" (Algolia API). Several already wired.
- **Normalize to a common schema; basic dedup** (company+title+location). Easy.

### 🟡 Moderate (real work, doable, mostly maintainable)
- **Workday / iCIMS / Taleo / SuccessFactors:** no single public API — per-tenant
  endpoints, fiddly, partial coverage. Per-connector effort.
- **The backend platform:** Postgres+Prisma, BullMQ queue, cron scheduler,
  Typesense/Elastic, embeddings + semantic search, REST API, admin dashboard, Docker.
  Standard but **multi-week** to do well.
- **Embedding-based dedup & recommendations:** moderate; cost grows with volume.

### 🔴 Hard / legally risky / not advisable
- **Scrapers for LinkedIn, Indeed, Naukri, Glassdoor, Monster:** ToS-prohibited,
  actively blocked, need residential proxies, **break constantly**, legal risk.
  ⚠️ This **contradicts the brief's own closing guardrail** — and the guardrail is
  right. Drop these or use only official partner APIs.
- **Discord/Slack/Telegram/Facebook/X harvesting:** fragmented, varied ToS, high
  upkeep, low ROI. (Reddit + HN have usable APIs; Twitter API is costly.)
- **"Millions of records":** feasible but a serious ops + cost commitment (storage,
  indexing, embedding compute).

### The real constraints
- **Maintenance, not building, is the killer.** ATS/API connectors are stable;
  scrapers rot weekly. A solo builder can sustain the 🟢 set, not 50 scrapers.
- **Cost:** 🟢 set ≈ $0. Add scrapers (proxies) + embeddings + hosted search +
  always-on backend ⇒ ~$50–500+/month.

### Recommended staging
- **Phase 0 — now (done):** `fetch-jobs.mjs` (ATS + free APIs) → per-job tailoring.
  Enough to *actually job-hunt today*.
- **Phase 1 — pragmatic mini-aggregator (days):** expand connectors to the full 🟢
  set (Ashby, SmartRecruiters, Workable, WWR, USAJobs, HN), add normalize + fuzzy
  dedup + a local SQLite/Postgres store + simple search. No scrapers. ~Free.
- **Phase 2 — product-scale (weeks + ongoing ops):** the full spec (queues, Typesense,
  embeddings, dashboard, Docker). Worth it only if building this as a *product*, not
  just to land one's own job.

**Bottom line:** the 🟢 layer is the 80/20 — it's free, maintainable, and already
started. The 🔴 scrapers are where cost/risk/maintenance explode and should be avoided.
Don't let building the engine block the actual job hunt.
