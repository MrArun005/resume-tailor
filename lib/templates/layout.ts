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
