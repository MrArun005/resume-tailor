# Tailorwright

Upload your résumé, paste a job description, and get a tailored version **in your
résumé's own layout**. Single-session and private — nothing is stored.

- **Layout fidelity:** the AI reads your PDF and reconstructs it as a self-contained
  HTML/CSS template, then rewrites the content for the job while preserving the design.
- **Grounded:** the model is instructed never to fabricate employers, titles, dates,
  degrees, or technologies — it only reframes what's truthfully in your résumé.
- **Exports:** PDF (pixel-accurate via headless Chromium), Word (.docx), plain text, Markdown.
- **Engines:** Claude and Gemini, switchable. Fast / Best quality toggle.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # for PDF export
cp .env.example .env.local              # add ANTHROPIC_API_KEY and/or GEMINI_API_KEY
pnpm dev
```

Open http://localhost:3000.

## How it works

1. `POST /api/analyze` — PDF → `{ content, templateHtml }` (layout reconstruction).
2. `POST /api/tailor` — `{ content, templateHtml, jobDescription }` → `{ tailoredContent, tailoredHtml, changes[] }`.
3. `POST /api/export` — `{ format, html | content }` → downloadable file.

See [`SPEC.md`](./SPEC.md) for the full design.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · `@anthropic-ai/sdk` · `@google/genai`
· Playwright · html-to-docx.
