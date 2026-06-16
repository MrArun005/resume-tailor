# Resume Tailor — Design Spec

**Date:** 2026-06-16
**Status:** Approved by Arun, building.

## What it is
Upload a resume PDF, paste a job description, and get the resume rewritten to match
the job — keeping the **same visual layout** as the uploaded resume. Single-session,
privacy-first (nothing stored). Exports to PDF, DOCX, and plain text/Markdown.

## Decisions
- **Layout fidelity:** reproduce *any* uploaded layout via **vision-reconstruction** —
  the model reads the PDF directly and rebuilds it as a self-contained HTML/CSS template.
  Tailoring edits the text in place, preserving the CSS/structure. It is a faithful
  re-creation, not a byte-identical clone.
- **AI:** provider abstraction supporting **Claude** and **Gemini**, switchable by env
  key + a Fast/Best tier toggle. Claude default.
- **Scope:** single session, no auth, no storage.
- **Exports:** PDF (Playwright/Chromium), DOCX (html-to-docx), TXT + Markdown (from
  structured content).

## Architecture
- **Stack:** Next.js 16 (App Router, TS) + Tailwind 4. Route handlers for the API.
- **Flow:**
  1. `POST /api/analyze` — PDF → `{ content (structured JSON), templateHtml }`.
  2. `POST /api/tailor` — `{ content, templateHtml, jobDescription }` → `{ tailoredContent, tailoredHtml, changes[] }`.
  3. `POST /api/export` — `{ format, html|content }` → downloadable file.
- **lib/ai:** `claude.ts`, `gemini.ts`, `index.ts` (`getProvider`), `prompts.ts`.
- **lib/content.ts:** structured-resume schema + TXT/Markdown serializers.

## Structured resume schema
```
{ name, headline, contact: string[],
  sections: [ { title, blocks: [ { heading, subheading, text, bullets: string[] } ] } ] }
```

## Trust features
- Side-by-side Original vs Tailored preview.
- A "What changed" panel listing every tailoring edit (from `changes[]`).
- Explicit prompt rule: never fabricate employers, titles, dates, degrees, or
  technologies — only reframe what's truthfully in the resume.
- Privacy banner: processed in-session, nothing persisted.

## Cost / latency (per resume)
- ~30–60s end to end; ~2¢ (Gemini Flash) to ~22¢ (Claude Opus) per run.
