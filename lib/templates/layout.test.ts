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
