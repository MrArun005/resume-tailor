# Résumé Templates + Reconstruction Fidelity — Design

Date: 2026-06-16
Status: Approved (pending spec review)

## Summary

Add a **template picker** to Tailorwright so a user can render their résumé content
into one of several polished, ATS-friendly layouts — **without replacing** the
existing "faithful mirror of your original" behavior. Separately, improve the
**fidelity** of that faithful mirror.

All current AI features stay as-is. The AI continues to produce the structured
`content` (and the mirror `templateHtml`). Templates are deterministic code that
the AI-produced `content` flows into. No new AI calls.

## Goals

1. Offer three ATS-safe, single-column templates: **Classic**, **Modern**, **Compact**.
2. Keep the AI **mirror** ("Your layout") as the default; templates are additional choices.
3. Let the user switch templates instantly in the preview, and export exactly what they see.
4. Improve the mirror's reconstruction fidelity and guarantee correct page margins/breaks.

## Non-Goals

- Two-column / sidebar templates (deferred — ATS-risky and page-break-prone).
- In-app editing of template typography/wording (separate future feature).
- Any change to how analyze/tailor call the model, or to the provider layer.

## Concepts: Two Orthogonal Controls

The preview gains a second control independent of the existing Original/Tailored tab.

- **Tab (existing):** which *content* — Original vs Tailored.
- **Layout (new):** which *design* — `Your layout` (AI mirror) · `Classic` · `Modern` · `Compact`.

The displayed/exported HTML is a function of both:

| Layout \ Tab | Original | Tailored |
|---|---|---|
| Your layout | `templateHtml` (AI) | `tailoredHtml` (AI), else `templateHtml` |
| Classic/Modern/Compact | `render(content)` | `render(tailoredContent ?? content)` |

Default Layout is `Your layout`, so existing behavior is unchanged until the user
picks a template.

## Architecture

### New module: `lib/templates/`

- `types.ts`
  - `export type TemplateId = "mirror" | "classic" | "modern" | "compact";`
  - `export interface Template { id: TemplateId; label: string; render(content: ResumeContent): string; }`
- `layout.ts` — shared building blocks so the three code templates do not duplicate
  print logic:
  - `escapeHtml(s: string): string`
  - `pageCss(): string` — the agreed print/pagination CSS:
    `@page { size: Letter; margin: 1.25cm }`, `body { margin: 0 }`,
    `.page { width: 100%; margin: 0; padding: 0; box-sizing: border-box }`,
    `* entry/heading rules: break-inside: avoid; page-break-inside: avoid;`
    headings `break-after: avoid`, and `print-color-adjust: exact`.
  - `documentShell({ bodyCss, bodyHtml }): string` — wraps a full `<!doctype html>`
    document with `<style>pageCss() + bodyCss</style>` and a single `.page` container.
- `classic.ts`, `modern.ts`, `compact.ts` — each exports a `Template`. Its `render`
  builds the inner HTML from `content` (name, headline, contact, sections → blocks →
  heading/subheading/text/bullets), escaping all text, and supplies its own
  `bodyCss` (typography/colors/spacing only). Differences:
  - **Classic:** Georgia/Times serif, centered name, underlined uppercase section headings.
  - **Modern:** Helvetica/Arial sans, left-aligned, accent-colored section headings with a bottom rule.
  - **Compact:** sans, smaller type and tighter spacing to fit long résumés; role + dates on one line.
- `index.ts` — `export const TEMPLATES: Template[]` (classic, modern, compact) and
  `export function getTemplate(id: TemplateId): Template | null` (returns null for
  `"mirror"`, which is not a code template).

All renderers are **pure functions of `content`** — they run client-side for instant
preview switching, cost no tokens, and are unit-testable in isolation.

### Fidelity improvements

- `lib/ai/prompts.ts` — strengthen `ANALYZE_PROMPT`: explicit capture of serif-vs-sans
  font family, exact section-heading styling, bold/italic emphasis runs, divider rules,
  right-aligned dates, and bullet glyph; reinforce "transcribe verbatim, never invent."
- `normalizeResumeHtml(html: string): string` (in `lib/templates/layout.ts`, reused by
  the analyze route) — guarantees the mirror output contains the print/pagination CSS.
  If the document already defines an `@page` margin it is left alone; otherwise a
  normalization `<style>` (the same `pageCss()` rules) is injected before `</head>`
  (or prepended if no head). Idempotent — never duplicates.

### Changed files

- `app/page.tsx`
  - New state: `template: TemplateId` (default `"mirror"`), persisted in the existing
    `localStorage` payload (bump `Persisted` shape; tolerate missing field on load).
  - Compute `showHtml`:
    1. `activeContent = tab === "tailored" ? (tailoredContent ?? content) : content`
    2. `mirrorHtml = tab === "tailored" && tailoredHtml ? tailoredHtml : templateHtml`
    3. `template === "mirror" ? mirrorHtml : getTemplate(template)!.render(activeContent as ResumeContent)`
  - New **Layout** selector UI (segmented control) in the preview header near the
    Original/Tailored tabs. Disabled until `content`/`templateHtml` exists.
  - `doExport` sends the same computed `showHtml` and `activeContent`, so the export
    matches the preview for every Layout × Tab combination.
- `app/api/analyze/route.ts` — wrap the returned `templateHtml` with `normalizeResumeHtml`.

### Preview margin injection interaction

`PreviewFrame` injects screen-only CSS that pads `.page` by `1.25cm` for on-screen
margins. Code templates also use a `.page` container, so the same injection gives
them consistent on-screen margins — no special-casing needed.

## Data Flow

1. Upload → `/api/analyze` → `{ content, templateHtml (normalized), engine }`.
2. (Optional) Tailor → `/api/tailor` → `{ tailoredContent, tailoredHtml, changes }`.
3. Preview computes `showHtml` from `{ tab, template, content, tailoredContent,
   templateHtml, tailoredHtml }`. Switching template/tab is instant (no network).
4. Export posts `showHtml` (+ `activeContent` for txt/md) to `/api/export` — unchanged route.

## Error Handling

- `getTemplate` returns null only for `"mirror"`; the preview never calls `render` in
  that case. For real template ids it always returns a `Template`.
- Renderers assume a valid `ResumeContent` (already validated server-side by
  `ResumeContentSchema`). Missing/empty fields render as empty sections, not errors.
- `normalizeResumeHtml` wraps its work defensively; on any failure it returns the
  input unchanged (mirror still works).
- localStorage hydrate tolerates a missing `template` field (defaults to `"mirror"`).

## Testing

Unit tests (pure, no network):

- For each template (`classic`/`modern`/`compact`), given a representative
  `ResumeContent`: output is a complete HTML doc, contains the name, every section
  title, every bullet, escapes HTML special characters in content, and includes the
  `@page ... margin: 1.25cm` and `break-inside: avoid` rules.
- `normalizeResumeHtml`: injects print CSS when absent; leaves a doc that already has
  `@page` margin unchanged; is idempotent (running twice == running once).

## Rollout / Verification

- Re-upload a PDF, confirm `Your layout` is unchanged and is now reliably margined.
- Switch Layout to Classic/Modern/Compact and confirm instant re-render of the
  current (original or tailored) content.
- Export PDF for each Layout and confirm 1.25cm margins on every page.
