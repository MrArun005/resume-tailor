---
name: apply
description: >-
  End-to-end job-application agent: pull a job posting, tailor the résumé to it,
  and produce a ready-to-send email draft (application or cold email) with the
  tailored résumé attached — for the user to review and send. Use when the user
  wants to "apply to this job", "draft an application", "send my résumé for this
  role", "write a cold email to this recruiter", or hands over a job link/posting
  and wants the whole application prepared. Builds on the tailor-resume skill.
---

# Apply — job → tailored résumé → ready-to-send draft

Take a job from a URL (or pasted posting) all the way to a draft the user only has
to review and send. Everything stays grounded in the candidate's real résumé — the
tailoring never fabricates, and the user is always the one who hits Send.

## Inputs to gather

1. **The job** — a posting URL (preferred) or pasted text. Also the candidate's
   **résumé** file (if not already known from the conversation).
2. **Send target** — an apply/recruiter email address if the user has one. If not,
   that's fine; the draft uses a clear placeholder the user fills in on review.
3. **Email kind** — application email, cold email, or let the context decide
   (application when there's an apply address; cold outreach when reaching a person).

## Workflow

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
