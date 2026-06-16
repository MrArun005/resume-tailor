import { NextRequest, NextResponse } from "next/server";
import { ResumeContentSchema, contentToText, contentToMarkdown } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 120;

type Format = "pdf" | "docx" | "txt" | "md";

function safeName(name: string, ext: string): string {
  const base = (name || "resume").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
  return `${base || "resume"}.${ext}`;
}

async function renderPdf(html: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // SSRF guard: the résumé HTML is client-supplied. Block ALL outbound network
    // and file:// loads so a crafted document cannot make the server fetch internal
    // services, cloud metadata, or local files. Our résumé documents are fully
    // self-contained (inline CSS, no external resources), so nothing legitimate is
    // fetched — only inline data:/about: for the document itself is allowed.
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("about:")) return route.continue();
      return route.abort();
    });
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      // Honor the document's own "@page { margin: 1.25cm }" so every page (not just
      // the first/last) gets identical margins. preferCSSPageSize makes Chromium
      // use the CSS @page size/margin instead of the margin option below.
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function renderDocx(html: string): Promise<Buffer> {
  const mod = await import("html-to-docx");
  const HTMLtoDOCX = (mod.default ?? mod) as (
    html: string,
    header?: string | null,
    opts?: Record<string, unknown>
  ) => Promise<ArrayBuffer | Buffer>;
  const out = await HTMLtoDOCX(html, null, { table: { row: { cantSplit: true } } });
  return Buffer.from(out as ArrayBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const format: Format = body.format;
    const filenameBase: string = body.filename || "resume";
    const html: string = body.html || "";

    // Size cap (anti-DoS): our résumé documents are well under 1MB.
    if (html.length > 3_000_000) {
      return NextResponse.json({ error: "Document too large." }, { status: 413 });
    }

    if (format === "txt" || format === "md") {
      const content = ResumeContentSchema.parse(body.content ?? {});
      const text = format === "md" ? contentToMarkdown(content) : contentToText(content);
      return new NextResponse(text, {
        headers: {
          "Content-Type": format === "md" ? "text/markdown" : "text/plain",
          "Content-Disposition": `attachment; filename="${safeName(filenameBase, format)}"`,
        },
      });
    }

    if (!html) {
      return NextResponse.json({ error: "Missing html for export." }, { status: 400 });
    }

    if (format === "pdf") {
      const pdf = await renderPdf(html);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName(filenameBase, "pdf")}"`,
        },
      });
    }

    if (format === "docx") {
      const docx = await renderDocx(html);
      return new NextResponse(new Uint8Array(docx), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeName(filenameBase, "docx")}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
