---
name: apply
description: >-
  End-to-end job-application agent: optionally SEARCH for matching jobs, pull a
  posting, tailor the résumé to it, and produce a ready-to-send email draft
  (application or cold email) with the tailored résumé attached — for the user to
  review and send. Use when the user wants to "find jobs for me", "apply to this
  job", "draft an application", "send my résumé for this role", "write a cold email
  to this recruiter", or hands over a job link/posting (or search criteria) and
  wants the application prepared. Builds on the tailor-resume skill.
---

# Apply — job → tailored résumé → ready-to-send draft

Take a job from a URL (or pasted posting) all the way to a draft the user only has
to review and send. Everything stays grounded in the candidate's real résumé — the
tailoring never fabricates, and the user is always the one who hits Send.

## Inputs to gather

1. **The job** — either a posting URL/pasted text, OR search criteria so the skill
   can **find jobs** (see step 0). Also the candidate's **résumé** file.
2. **Send target** — an apply/recruiter email address if the user has one. If not,
   that's fine; the draft uses a clear placeholder the user fills in on review.
3. **Email kind** — application email, cold email, or let the context decide
   (application when there's an apply address; cold outreach when reaching a person).

## Workflow

### 0. Find jobs (when the user hasn't given a specific posting)

If the user wants the skill to *find* roles rather than supplying a URL, gather a
few criteria — **role/title, location (or remote), seniority, and any must-haves**
(stack, company type). Infer sensible defaults from the résumé when the user is
terse (e.g. their current title + city).

Then search:
- Use the **web search** tool for queries like `"<role>" "<location>" jobs` or
  source-scoped queries (`site:boards.greenhouse.io <role>`, `site:jobs.lever.co`,
  `site:job-boards.greenhouse.io`) to surface real, linkable postings.
- Or drive the **browser engine** to a board's results page and extract listings.

Present a **shortlist (5–8)**: title · company · location · link. Let the user pick
one (or a few). Then continue from step 1 for each chosen posting. Don't invent
postings or links — only list results you actually found; if search is thin, say so
and ask the user to narrow or supply a URL.

### 1. Pull the job details (browser engine)

If given a URL, use the available **browser tool** to fetch it — Playwright MCP
(`browser_navigate` then `browser_snapshot`), or a headless browser — and extract:
**job title, company, the full job description, and any apply or recruiter email**
shown on the page. Read the snapshot/text; don't guess.

If the board blocks automated loading (login walls, bot checks), say so and ask the
user to paste the posting. Public postings are fine to read; don't attempt to bypass
logins or anti-bot protection.

### 2. Tailor the résumé

Invoke the **tailor-resume** skill with the extracted job description (and the
candidate's résumé). Run its full flow — the gap-interview, the truthful tailoring,
render, and PDF — producing a résumé named `<Candidate> - <Company> - <YYYY-MM-DD>.pdf`.
Keep its ATS coverage report; it's useful context for the email.

### 3. Draft the email

Write the email body grounded in the résumé and JD. Keep it short, specific, and
human — no fluff, no buzzword soup. Tailor the *kind*:

- **Application email** — to a careers/apply address. Subject like
  `Application — <Role> — <Candidate>`. 2–4 short paragraphs: why this role, the 2–3
  most relevant proof points from the résumé, a clear close. Mention the résumé is
  attached.
- **Cold email** — to a named recruiter/hiring manager. Shorter and more personal:
  one line of genuine relevance to *them/the team*, 2–3 sentences of strongest fit,
  a low-friction ask (a quick chat). Subject like
  `<Role> — <Candidate>, <one-line hook>`.

Write the chosen body to a text file (e.g. `email-body.txt`) so it passes cleanly to
the next step. Show the user the body and let them tweak it before drafting.

### 4. Build the .eml draft

Run the bundled script — it writes a standard `.eml` with the body and the résumé
PDF attached (and `X-Unsent` so it opens as an editable draft):

```bash
node scripts/mkdraft.mjs \
  --to "careers@company.com" \
  --subject "Application — <Role> — <Candidate>" \
  --body-file email-body.txt \
  --attach "<Candidate> - <Company> - <YYYY-MM-DD>.pdf" \
  --out "<Candidate> - <Company> - application.eml"
```

If you don't have the address, omit `--to` (it inserts `RECRUITER_EMAIL_HERE`) and
tell the user to fill it in. Use `--cc` for additional recipients.

### 5. Deliver

State the **absolute paths** of both the résumé PDF and the `.eml` draft, then:

> Double-click the `.eml` to open it as a draft in your mail app (Apple Mail,
> Outlook, etc.), review/adjust, and hit Send. The résumé is already attached.

Briefly recap what you tailored and the ATS coverage. Make clear the user reviews and
sends — never imply anything was sent automatically.

## Notes

- **You never send anything.** This skill only prepares drafts; sending is always the
  user's explicit action in their own mail client.
- For multiple roles, repeat per job — each gets its own résumé PDF + `.eml`.
- Want both an application and a cold email for the same role? Produce two `.eml`
  files with distinct names (`… - application.eml`, `… - cold.eml`).
