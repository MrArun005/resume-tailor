---
name: tailor-resume
description: >-
  Tailor a résumé to a specific job description and render it into a clean,
  ATS-friendly template — entirely locally, with no API key, no web server, and
  no third-party service (Claude does the rewriting; a bundled script renders the
  output). Use this whenever the user wants to tailor, customize, rewrite, or
  optimize a résumé/CV for a particular job posting or role, asks to "make my
  resume fit this job", wants a résumé reformatted into a nicer/ATS template, or
  hands over a résumé file plus a job description. Trigger even if they don't say
  the word "tailor" — e.g. "here's my CV and the JD, help me apply", "punch up my
  resume for this posting", "reformat my resume for an ATS".
---

# Tailor Résumé

Rewrite a candidate's résumé to align with a target job — truthfully — and render
it into a polished, ATS-safe layout. Everything runs locally: you (Claude) do the
reading and rewriting, and a dependency-free script turns the result into a
print-ready HTML document. No API keys, no server, no data leaves the machine.

## Why this exists / what good looks like

A tailored résumé should read like the *same person* sharpened for *this role*:
the strongest, most relevant experience surfaced first, the JD's real language
mirrored where it's genuinely true, weak phrasing tightened, and nothing invented.
The candidate's facts are sacred — you reframe and reorder, you don't fabricate.

## Inputs to gather

Ask only for what's missing; infer the rest from the conversation.

1. **Résumé** — a file path (PDF, .txt, .md, .docx) or pasted text. Read it with the
   Read tool. PDFs are readable directly.
2. **Job description** — pasted text or a file/URL. The more complete, the sharper.
3. **Template** (optional) — `classic` (serif, traditional, default), `modern`
   (sans, accent headings), or `compact` (dense, fits more on a page). All three
   are single-column and ATS-friendly.
4. **Customization / highlights** (optional) — specific points the candidate wants
   included (e.g. "led a team of 6", "AWS certified"). Treat these as TRUE facts
   the candidate is supplying — they are not fabrication.

## Workflow

### 1. Read and structure the résumé

Extract the résumé into this exact JSON shape (transcribe verbatim — do not
summarize, add, or drop anything at this stage):

```json
{
  "name": "string",
  "headline": "string — title/tagline; \"\" if none",
  "contact": ["each contact/link item: email, phone, location, LinkedIn, etc."],
  "sections": [
    {
      "title": "section heading exactly as written, e.g. EXPERIENCE",
      "blocks": [
        {
          "heading": "role + company, project name, or skill category; \"\" if none",
          "subheading": "dates, location, or tech stack; \"\" if none",
          "text": "paragraph text such as a summary; \"\" if none",
          "bullets": ["bullet point", "..."]
        }
      ]
    }
  ]
}
```

### 2. Tailor the content to the job

Produce a tailored copy of that JSON. Apply these principles (explained so you can
exercise judgment, not follow blindly):

- **Mirror the JD's real language.** Adopt the posting's keywords, required skills,
  and terminology — but only where it's genuinely true of the candidate. ATS systems
  and humans both reward this; lying fails both.
- **Lead with impact.** Front-load quantified outcomes; tighten generic or passive
  phrasing into concrete results.
- **Reorder for relevance.** Surface the experience, skills, and projects this role
  cares about; de-emphasize the rest. You may reorder sections/blocks/bullets.
- **Incorporate the customization points** (if any) as true facts, folded into the
  most relevant section and phrased to fit the résumé's voice. Don't duplicate a
  point that's already present, and don't flag them with special formatting.

**Hard constraint — never fabricate.** Do not invent or alter employers, titles,
dates, degrees, certifications, or technologies. Everything must be grounded in the
original résumé *or* in the candidate's own customization input. Rephrase, reframe,
reorder — never make things up.

### 3. Render

Write the tailored JSON to a file (e.g. `tailored.json`), then run the bundled
renderer from this skill's directory:

```bash
node scripts/render.mjs tailored.json <template> "<Candidate Name> - tailored.html"
```

`<template>` is `classic`, `modern`, or `compact`. The output is a complete,
self-contained HTML document with print margins (1.25cm on every page) and smart
pagination already baked in.

### 4. Deliver

- Tell the user where the HTML file is.
- **For a PDF:** open the HTML in any browser and Print → "Save as PDF". The page
  size (US Letter) and 1.25cm margins are already set via CSS `@page`, so the PDF
  matches the preview exactly. (If `playwright`/`puppeteer` or a headless Chrome is
  available and the user wants automation, you may render the PDF directly instead.)
- **Summarize what changed** — 4–8 short, plain-language notes (e.g. "Reordered
  Skills to lead with the cloud stack the JD emphasizes", "Quantified the migration
  bullet with the 40% latency figure you mentioned"). This lets the candidate review
  before sending.

## Notes

- Want plain text or Markdown instead of styled HTML? You can emit those directly
  from the structured JSON without the renderer.
- The template CSS in `scripts/render.mjs` mirrors the companion web app's
  `lib/templates/`; keep them in sync if you change either.
