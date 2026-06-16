# Résumé Templates + Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ATS-friendly template picker (Classic/Modern/Compact) that renders the AI-produced résumé content into a chosen layout, alongside the existing faithful mirror, and harden the mirror's print/pagination fidelity.

**Architecture:** Templates are pure deterministic functions of the structured `ResumeContent` (no AI). They share one print/pagination CSS scaffold and one body-rendering function, differing only in styling CSS. The preview gains a second control (Layout) orthogonal to the existing Original/Tailored tab; switching is instant and client-side. The mirror's analyze output is passed through `normalizeResumeHtml` to guarantee the agreed `@page` margin / `break-inside` rules.

**Tech Stack:** Next.js 16 (App Router, client component), React 19, TypeScript, zod, Vitest (new), pnpm.

> **Repo note (AGENTS.md):** This is a modified Next.js. Before editing `app/page.tsx` or any route, skim the relevant guide under `node_modules/next/dist/docs/` for App Router / client-component conventions.

---

## File Structure

**Create:**
- `vitest.config.ts` — test runner config with tsconfig path resolution.
- `lib/templates/types.ts` — `TemplateId`, `Template` interface.
- `lib/templates/layout.ts` — `escapeHtml`, `pageCss`, `renderBody`, `documentShell`, `normalizeResumeHtml`.
- `lib/templates/classic.ts`, `modern.ts`, `compact.ts` — the three `Template`s.
- `lib/templates/index.ts` — `TEMPLATES` registry + `getTemplate`.
- `lib/templates/__fixtures__/sample.ts` — shared `ResumeContent` test fixture.
- `lib/templates/layout.test.ts`, `classic.test.ts`, `modern.test.ts`, `compact.test.ts`, `index.test.ts` — unit tests.

**Modify:**
- `package.json` — add Vitest devDeps + `test` script.
- `app/api/analyze/route.ts` — normalize the mirror HTML.
- `app/page.tsx` — Layout state, selector UI, `showHtml` computation, export wiring, persistence.
- `lib/ai/prompts.ts` — strengthen `ANALYZE_PROMPT` fidelity instructions.

---

## Task 1: Add Vitest test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
pnpm add -D vitest vite-tsconfig-paths
```
Expected: both added under `devDependencies`, lockfile updated.

- [ ] **Step 2: Add the `test` scripts to `package.json`**

In the `"scripts"` block, change:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
```
to:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner starts (no tests yet)**

Run: `pnpm test`
Expected: Vitest runs and reports "No test files found" (exit non-zero is fine at this point) — confirms config loads without error.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest test tooling"
```

---

## Task 2: Template types, shared layout, and normalizer

**Files:**
- Create: `lib/templates/types.ts`
- Create: `lib/templates/layout.ts`
- Create: `lib/templates/__fixtures__/sample.ts`
- Test: `lib/templates/layout.test.ts`

- [ ] **Step 1: Create `lib/templates/types.ts`**

```ts
import type { ResumeContent } from "@/lib/content";

export type TemplateId = "mirror" | "classic" | "modern" | "compact";

export interface Template {
  id: TemplateId;
  label: string;
  render(content: ResumeContent): string;
}
```

- [ ] **Step 2: Create the shared test fixture `lib/templates/__fixtures__/sample.ts`**

```ts
import type { ResumeContent } from "@/lib/content";

// Name contains angle brackets to exercise HTML escaping.
export const SAMPLE: ResumeContent = {
  name: "Arun <Test> Mallikarjun",
  headline: "Senior Engineer",
  contact: ["arun@example.com", "Bangalore"],
  sections: [
    {
      title: "Experience",
      blocks: [
        {
          heading: "Senior Engineer — Acme",
          subheading: "2021–Present",
          text: "",
          bullets: ["Cut latency 40%", "Owned billing services"],
        },
      ],
    },
    {
      title: "Skills",
      blocks: [{ heading: "", subheading: "", text: "Node.js, React, AWS", bullets: [] }],
    },
  ],
};
```

- [ ] **Step 3: Write the failing tests `lib/templates/layout.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { escapeHtml, pageCss, renderBody, normalizeResumeHtml } from "./layout";
import { SAMPLE } from "./__fixtures__/sample";

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<a> & "b" 'c'`)).toBe("&lt;a&gt; &amp; &quot;b&quot; &#39;c&#39;");
  });
});

describe("pageCss", () => {
  it("declares the 1.25cm page margin and break-inside rules", () => {
    const css = pageCss();
    expect(css).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
    expect(css).toMatch(/break-inside:\s*avoid/i);
  });
});

describe("renderBody", () => {
  it("renders escaped name, section titles, text, and bullets", () => {
    const html = renderBody(SAMPLE);
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Experience");
    expect(html).toContain("Skills");
    expect(html).toContain("Cut latency 40%");
    expect(html).toContain("Node.js, React, AWS");
    expect(html).toContain('class="rt-entry"');
  });
});

describe("normalizeResumeHtml", () => {
  const noPage = `<html><head><style>body{margin:0}</style></head><body>x</body></html>`;

  it("injects print CSS when @page margin is absent", () => {
    const out = normalizeResumeHtml(noPage);
    expect(out).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
  });

  it("leaves a document that already sets an @page margin unchanged", () => {
    const withPage = `<html><head><style>@page{size:Letter;margin:2cm}</style></head><body>x</body></html>`;
    expect(normalizeResumeHtml(withPage)).toBe(withPage);
  });

  it("is idempotent", () => {
    const once = normalizeResumeHtml(noPage);
    expect(normalizeResumeHtml(once)).toBe(once);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm test lib/templates/layout.test.ts`
Expected: FAIL — `./layout` cannot be resolved / exports undefined.

- [ ] **Step 5: Create `lib/templates/layout.ts`**

```ts
import type { ResumeContent } from "@/lib/content";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shared print/pagination CSS. Keeps every template (and the normalized mirror)
// on identical page geometry: 1.25cm margins on every page; entries never split
// across a page boundary; a heading never sits alone at the bottom of a page.
export function pageCss(): string {
  return `
@page { size: Letter; margin: 1.25cm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 100%; margin: 0; padding: 0; }
.rt-entry { break-inside: avoid; page-break-inside: avoid; }
.rt-sec-title, .rt-entry-head { break-after: avoid; page-break-after: avoid; }
`.trim();
}

// Render the structured content into semantic, class-tagged HTML. All three
// templates share this structure and style it via their own CSS, so the markup
// (and the break-inside hooks) stay consistent.
export function renderBody(c: ResumeContent): string {
  const parts: string[] = [];
  parts.push(`<header class="rt-head">`);
  if (c.name) parts.push(`<h1 class="rt-name">${escapeHtml(c.name)}</h1>`);
  if (c.headline) parts.push(`<div class="rt-headline">${escapeHtml(c.headline)}</div>`);
  if (c.contact.length) {
    parts.push(
      `<div class="rt-contact">${c.contact.map(escapeHtml).join('<span class="rt-sep"> · </span>')}</div>`
    );
  }
  parts.push(`</header>`);

  for (const s of c.sections) {
    parts.push(`<section class="rt-sec">`);
    if (s.title) parts.push(`<h2 class="rt-sec-title">${escapeHtml(s.title)}</h2>`);
    for (const b of s.blocks) {
      parts.push(`<div class="rt-entry">`);
      if (b.heading || b.subheading) {
        parts.push(`<div class="rt-entry-head">`);
        if (b.heading) parts.push(`<span class="rt-heading">${escapeHtml(b.heading)}</span>`);
        if (b.subheading) parts.push(`<span class="rt-sub">${escapeHtml(b.subheading)}</span>`);
        parts.push(`</div>`);
      }
      if (b.text) parts.push(`<p class="rt-text">${escapeHtml(b.text)}</p>`);
      if (b.bullets.length) {
        parts.push(`<ul class="rt-bullets">`);
        for (const bullet of b.bullets) parts.push(`<li>${escapeHtml(bullet)}</li>`);
        parts.push(`</ul>`);
      }
      parts.push(`</div>`);
    }
    parts.push(`</section>`);
  }
  return parts.join("\n");
}

// Wrap template CSS + body into a complete, self-contained HTML document.
export function documentShell(opts: { bodyCss: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${pageCss()}
${opts.bodyCss}
</style>
</head>
<body>
<div class="page">
${opts.bodyHtml}
</div>
</body>
</html>`;
}

// Guarantee an AI-generated mirror document carries the print/pagination CSS.
// Idempotent: if the document already declares an @page margin, leave it as-is.
export function normalizeResumeHtml(html: string): string {
  try {
    if (/@page[^}]*margin/i.test(html)) return html;
    const inject = `<style>\n${pageCss()}\n</style>`;
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${inject}</head>`);
    if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1${inject}`);
    return inject + html;
  } catch {
    return html;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test lib/templates/layout.test.ts`
Expected: PASS (6 assertions across 4 describe blocks).

- [ ] **Step 7: Commit**

```bash
git add lib/templates/types.ts lib/templates/layout.ts lib/templates/__fixtures__/sample.ts lib/templates/layout.test.ts
git commit -m "feat: template types, shared layout renderer, and html normalizer"
```

---

## Task 3: Classic template

**Files:**
- Create: `lib/templates/classic.ts`
- Test: `lib/templates/classic.test.ts`

- [ ] **Step 1: Write the failing test `lib/templates/classic.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { classicTemplate } from "./classic";
import { SAMPLE } from "./__fixtures__/sample";

describe("classicTemplate", () => {
  const html = classicTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(classicTemplate.id).toBe("classic");
    expect(classicTemplate.label).toBe("Classic");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
    expect(html).toMatch(/break-inside:\s*avoid/i);
  });

  it("renders escaped content and uses a serif font", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Experience");
    expect(html).toContain("Cut latency 40%");
    expect(html).toMatch(/Georgia/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/templates/classic.test.ts`
Expected: FAIL — `./classic` not found.

- [ ] **Step 3: Create `lib/templates/classic.ts`**

```ts
import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 11pt; line-height: 1.4; }
.rt-head { text-align: center; margin-bottom: 10pt; }
.rt-name { font-size: 20pt; font-weight: 700; margin: 0; letter-spacing: .02em; }
.rt-headline { font-style: italic; color: #444; margin-top: 2pt; }
.rt-contact { font-size: 9.5pt; color: #444; margin-top: 4pt; }
.rt-sec { margin-top: 12pt; }
.rt-sec-title { font-size: 12pt; text-transform: uppercase; letter-spacing: .08em; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2pt; margin: 0 0 6pt; }
.rt-entry { margin-bottom: 8pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #555; font-style: italic; white-space: nowrap; }
.rt-text { margin: 2pt 0; }
.rt-bullets { margin: 3pt 0 0; padding-left: 16pt; }
.rt-bullets li { margin: 1.5pt 0; }
`.trim();

export const classicTemplate: Template = {
  id: "classic",
  label: "Classic",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/templates/classic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/templates/classic.ts lib/templates/classic.test.ts
git commit -m "feat: classic résumé template"
```

---

## Task 4: Modern template

**Files:**
- Create: `lib/templates/modern.ts`
- Test: `lib/templates/modern.test.ts`

- [ ] **Step 1: Write the failing test `lib/templates/modern.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { modernTemplate } from "./modern";
import { SAMPLE } from "./__fixtures__/sample";

describe("modernTemplate", () => {
  const html = modernTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(modernTemplate.id).toBe("modern");
    expect(modernTemplate.label).toBe("Modern");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
  });

  it("renders escaped content and uses a sans-serif font with an accent color", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Owned billing services");
    expect(html).toMatch(/Helvetica|Arial/i);
    expect(html).toMatch(/#1f3a5f/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/templates/modern.test.ts`
Expected: FAIL — `./modern` not found.

- [ ] **Step 3: Create `lib/templates/modern.ts`**

```ts
import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.45; }
.rt-head { margin-bottom: 12pt; }
.rt-name { font-size: 22pt; font-weight: 700; margin: 0; color: #1f3a5f; }
.rt-headline { color: #374151; margin-top: 2pt; font-size: 11pt; }
.rt-contact { font-size: 9.5pt; color: #4b5563; margin-top: 5pt; }
.rt-sec { margin-top: 13pt; }
.rt-sec-title { font-size: 11pt; text-transform: uppercase; letter-spacing: .1em; color: #1f3a5f; border-bottom: 2px solid #1f3a5f; padding-bottom: 2pt; margin: 0 0 6pt; }
.rt-entry { margin-bottom: 9pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #6b7280; white-space: nowrap; font-size: 9.5pt; }
.rt-text { margin: 2pt 0; }
.rt-bullets { margin: 3pt 0 0; padding-left: 16pt; }
.rt-bullets li { margin: 2pt 0; }
`.trim();

export const modernTemplate: Template = {
  id: "modern",
  label: "Modern",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/templates/modern.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/templates/modern.ts lib/templates/modern.test.ts
git commit -m "feat: modern résumé template"
```

---

## Task 5: Compact template

**Files:**
- Create: `lib/templates/compact.ts`
- Test: `lib/templates/compact.test.ts`

- [ ] **Step 1: Write the failing test `lib/templates/compact.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { compactTemplate } from "./compact";
import { SAMPLE } from "./__fixtures__/sample";

describe("compactTemplate", () => {
  const html = compactTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(compactTemplate.id).toBe("compact");
    expect(compactTemplate.label).toBe("Compact");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
  });

  it("renders content with a small base font for density", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Cut latency 40%");
    expect(html).toMatch(/font-size:\s*9\.5pt/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/templates/compact.test.ts`
Expected: FAIL — `./compact` not found.

- [ ] **Step 3: Create `lib/templates/compact.ts`**

```ts
import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 9.5pt; line-height: 1.3; }
.rt-head { margin-bottom: 7pt; }
.rt-name { font-size: 16pt; font-weight: 700; margin: 0; }
.rt-headline { color: #374151; margin-top: 1pt; font-size: 10pt; }
.rt-contact { font-size: 8.5pt; color: #4b5563; margin-top: 2pt; }
.rt-sec { margin-top: 8pt; }
.rt-sec-title { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #9ca3af; padding-bottom: 1pt; margin: 0 0 4pt; }
.rt-entry { margin-bottom: 5pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 6pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #6b7280; white-space: nowrap; font-size: 8.5pt; }
.rt-text { margin: 1pt 0; }
.rt-bullets { margin: 2pt 0 0; padding-left: 14pt; }
.rt-bullets li { margin: 1pt 0; }
`.trim();

export const compactTemplate: Template = {
  id: "compact",
  label: "Compact",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/templates/compact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/templates/compact.ts lib/templates/compact.test.ts
git commit -m "feat: compact résumé template"
```

---

## Task 6: Template registry

**Files:**
- Create: `lib/templates/index.ts`
- Test: `lib/templates/index.test.ts`

- [ ] **Step 1: Write the failing test `lib/templates/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { TEMPLATES, getTemplate } from "./index";

describe("template registry", () => {
  it("lists the three code templates in order", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "modern", "compact"]);
  });

  it("resolves a code template by id", () => {
    expect(getTemplate("modern")?.label).toBe("Modern");
  });

  it("returns null for the mirror id (not a code template)", () => {
    expect(getTemplate("mirror")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/templates/index.test.ts`
Expected: FAIL — `./index` not found.

- [ ] **Step 3: Create `lib/templates/index.ts`**

```ts
import type { Template, TemplateId } from "./types";
import { classicTemplate } from "./classic";
import { modernTemplate } from "./modern";
import { compactTemplate } from "./compact";

export const TEMPLATES: Template[] = [classicTemplate, modernTemplate, compactTemplate];

export function getTemplate(id: TemplateId): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export type { Template, TemplateId } from "./types";
```

- [ ] **Step 4: Run the test to verify it passes, then the full suite**

Run: `pnpm test`
Expected: PASS — all template + layout test files green.

- [ ] **Step 5: Commit**

```bash
git add lib/templates/index.ts lib/templates/index.test.ts
git commit -m "feat: template registry"
```

---

## Task 7: Normalize the mirror HTML in the analyze route

**Files:**
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Import the normalizer**

In `app/api/analyze/route.ts`, change:
```ts
import { ResumeContentSchema, extractJson } from "@/lib/content";
```
to:
```ts
import { ResumeContentSchema, extractJson } from "@/lib/content";
import { normalizeResumeHtml } from "@/lib/templates/layout";
```

- [ ] **Step 2: Apply normalization to the returned templateHtml**

Change:
```ts
    const parsed = extractJson(raw) as { content?: unknown; templateHtml?: unknown };
    const content = ResumeContentSchema.parse(parsed.content ?? {});
    const templateHtml = typeof parsed.templateHtml === "string" ? parsed.templateHtml : "";
```
to:
```ts
    const parsed = extractJson(raw) as { content?: unknown; templateHtml?: unknown };
    const content = ResumeContentSchema.parse(parsed.content ?? {});
    const templateHtml =
      typeof parsed.templateHtml === "string" ? normalizeResumeHtml(parsed.templateHtml) : "";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: guarantee print/pagination CSS on mirror output"
```

---

## Task 8: Layout picker, render selection, export wiring, persistence

**Files:**
- Modify: `app/page.tsx`

> Per AGENTS.md, before editing skim `node_modules/next/dist/docs/` for any client-component changes in this Next version. `app/page.tsx` is already a `"use client"` component using hooks — keep that pattern.

- [ ] **Step 1: Add imports**

At the top of `app/page.tsx`, below `import { PreviewFrame } from "@/components/PreviewFrame";`, add:
```ts
import { TEMPLATES, getTemplate, type TemplateId } from "@/lib/templates";
import type { ResumeContent } from "@/lib/content";
```

- [ ] **Step 2: Add `template` to the persisted shape**

Change the `Persisted` type:
```ts
type Persisted = {
  fileName: string;
  jd: string;
  tier: Tier;
  templateHtml: string;
  content: unknown;
  tailoredHtml: string;
  tailoredContent: unknown;
  changes: string[];
  engine: Engine | null;
  tab: Tab;
};
```
to add the field:
```ts
type Persisted = {
  fileName: string;
  jd: string;
  tier: Tier;
  templateHtml: string;
  content: unknown;
  tailoredHtml: string;
  tailoredContent: unknown;
  changes: string[];
  engine: Engine | null;
  tab: Tab;
  template: TemplateId;
};
```

- [ ] **Step 3: Add the `template` state**

Below `const [tab, setTab] = useState<Tab>("original");` add:
```ts
  const [template, setTemplate] = useState<TemplateId>("mirror");
```

- [ ] **Step 4: Hydrate `template` from storage**

In the restore `useEffect`, below `if (s.tab) setTab(s.tab);` add:
```ts
        if (s.template) setTemplate(s.template);
```

- [ ] **Step 5: Persist `template`**

In the save `useEffect`, change the `data` object and dependency array to include `template`:

Change:
```ts
      const data: Persisted = {
        fileName,
        jd,
        tier,
        templateHtml,
        content,
        tailoredHtml,
        tailoredContent,
        changes,
        engine,
        tab,
      };
```
to:
```ts
      const data: Persisted = {
        fileName,
        jd,
        tier,
        templateHtml,
        content,
        tailoredHtml,
        tailoredContent,
        changes,
        engine,
        tab,
        template,
      };
```

And change the dependency array end from:
```ts
    engine,
    tab,
  ]);
```
to:
```ts
    engine,
    tab,
    template,
  ]);
```

- [ ] **Step 6: Replace the `showHtml` computation with template-aware logic**

Change:
```ts
  const busy = phase === "analyzing" || phase === "tailoring";
  const noProvider = providers !== null && providers.length === 0;
  const showHtml = tab === "tailored" && tailoredHtml ? tailoredHtml : templateHtml;
```
to:
```ts
  const busy = phase === "analyzing" || phase === "tailoring";
  const noProvider = providers !== null && providers.length === 0;
  const activeContent = (tab === "tailored" ? tailoredContent : content) as ResumeContent | null;
  const mirrorHtml = tab === "tailored" && tailoredHtml ? tailoredHtml : templateHtml;
  const showHtml =
    template === "mirror"
      ? mirrorHtml
      : activeContent
        ? (getTemplate(template)?.render(activeContent) ?? mirrorHtml)
        : mirrorHtml;
```

- [ ] **Step 7: Use the displayed HTML/content for export**

In `doExport`, change:
```ts
      const html = tailoredHtml || templateHtml;
      const exportContent = tailoredContent || content;
```
to:
```ts
      const html = showHtml;
      const exportContent = activeContent ?? content;
```

- [ ] **Step 8: Add the Layout selector UI above the preview tabs**

Find the preview block:
```tsx
          {/* ---------- Preview ---------- */}
          <div>
            <div className="preview-tabs">
```
and insert the Layout selector between the opening `<div>` and `<div className="preview-tabs">`:
```tsx
          {/* ---------- Preview ---------- */}
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: 12, flexWrap: "wrap" }}
            >
              <span className="micro">Layout</span>
              <div className="seg">
                <button
                  className={template === "mirror" ? "on" : ""}
                  disabled={!templateHtml}
                  onClick={() => setTemplate("mirror")}
                >
                  Your layout
                </button>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className={template === t.id ? "on" : ""}
                    disabled={!templateHtml}
                    onClick={() => setTemplate(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="preview-tabs">
```

- [ ] **Step 9: Verify typecheck and build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `pnpm build`
Expected: build completes without errors.

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx
git commit -m "feat: layout picker renders content into selected template"
```

---

## Task 9: Strengthen analyze prompt fidelity

**Files:**
- Modify: `lib/ai/prompts.ts`

- [ ] **Step 1: Add fidelity instructions to `ANALYZE_PROMPT`**

In `lib/ai/prompts.ts`, find this line inside the `templateHtml` rules:
```ts
- Match the original design precisely: page geometry (US Letter, portrait — the .page fills the printable area; the page margins are handled by @page, so do NOT add your own page padding/margin to .page), section-heading style (color, uppercase, letter-spacing, underline rules/borders), font families and sizes, text colors, line spacing, bullet style, single- vs two-column layout, and right-aligned dates if the original right-aligns them.
```
and replace it with:
```ts
- Match the original design precisely: page geometry (US Letter, portrait — the .page fills the printable area; the page margins are handled by @page, so do NOT add your own page padding/margin to .page), section-heading style (color, uppercase, letter-spacing, underline rules/borders), font families and sizes, text colors, line spacing, bullet style, single- vs two-column layout, and right-aligned dates if the original right-aligns them.
- Reproduce typographic detail faithfully: detect whether the original is serif or sans-serif and pick a matching system font stack; preserve bold/italic emphasis exactly where the original uses it; reproduce horizontal divider rules; keep section headings and their casing/wording identical to the source.
- Do NOT add, remove, summarize, or reorder any content — the rendered text must match the resume verbatim, only its presentation is reconstructed.
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/prompts.ts
git commit -m "feat: strengthen analyze prompt for higher-fidelity mirror"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all template/layout/registry tests PASS.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev` and open the app.

- [ ] **Step 3: Verify the mirror path is unchanged**

Upload a PDF. Confirm the preview renders with the default `Your layout`, and that the Layout selector shows `Your layout · Classic · Modern · Compact` (disabled until analysis completes).

- [ ] **Step 4: Verify template switching**

Click `Classic`, `Modern`, `Compact` — each re-renders the current content instantly with no network call. Paste a JD, tailor, and confirm switching templates now renders the *tailored* content.

- [ ] **Step 5: Verify export matches the preview**

With a template selected, export PDF and confirm: the downloaded PDF matches the on-screen template and has 1.25cm margins on every page (including page 2+). Repeat for `Your layout`.

- [ ] **Step 6: Verify persistence**

Refresh the browser. Confirm the selected Layout, tab, content, and tailored result are all restored.

---

## Self-Review Notes

- **Spec coverage:** Templates module (Tasks 2–6) ✓; two orthogonal controls + render selection + export-as-seen (Task 8) ✓; persistence of `template` (Task 8) ✓; fidelity prompt (Task 9) + `normalizeResumeHtml` guarantee (Tasks 2, 7) ✓; TDD for renderers + normalizer (Tasks 2–6) ✓; mirror unchanged by default (`template` defaults to `"mirror"`) ✓.
- **Type consistency:** `Template`/`TemplateId` defined in Task 2 and reused unchanged in Tasks 3–6, 8; `getTemplate` returns `Template | null` and the page guards the `mirror`/null case; `renderBody`/`documentShell`/`pageCss`/`normalizeResumeHtml` signatures match between definition (Task 2) and all call sites.
- **No placeholders:** every code/step shows complete content and exact commands.
