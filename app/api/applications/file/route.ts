import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { ResumeContentSchema, contentToText } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve a prepared application's résumé/cover PDF (download) or the résumé as plain
// text (for the "copy" button). The code maps to a manifest entry whose folder +
// filename we trust — user input never builds a path directly (no traversal).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";
  const kind = (req.nextUrl.searchParams.get("kind") || "resume") as "resume" | "cover" | "text";
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const appsDir = join(process.cwd(), "applications");
  let manifest: { applications?: Array<Record<string, string>> };
  try {
    manifest = JSON.parse(await readFile(join(appsDir, "manifest.json"), "utf8"));
  } catch {
    return NextResponse.json({ error: "No applications yet." }, { status: 404 });
  }
  const app = (manifest.applications || []).find((a) => a.code === code);
  if (!app) return NextResponse.json({ error: "Unknown application code." }, { status: 404 });

  const folderDir = join(appsDir, String(app.folder));

  // Helper: resolve a filename inside the application folder, refusing anything
  // that escapes it.
  const within = (name: string) => {
    const p = resolve(folderDir, name);
    if (p !== folderDir && !p.startsWith(folderDir + sep)) return null;
    return p;
  };

  if (kind === "text") {
    const p = within("content.json");
    if (!p) return NextResponse.json({ error: "Bad path." }, { status: 400 });
    try {
      const content = ResumeContentSchema.parse(JSON.parse(await readFile(p, "utf8")));
      return new NextResponse(contentToText(content), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json({ error: "Résumé content unavailable." }, { status: 404 });
    }
  }

  const fileName = kind === "cover" ? app.coverFile : app.resumeFile;
  if (!fileName) return NextResponse.json({ error: `No ${kind} file.` }, { status: 404 });
  const p = within(fileName);
  if (!p) return NextResponse.json({ error: "Bad path." }, { status: 400 });
  try {
    const buf = await readFile(p);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
