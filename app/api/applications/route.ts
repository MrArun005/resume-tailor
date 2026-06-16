import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always reflect the latest manifest on disk

// Returns the prepared-applications manifest (applications/manifest.json), written
// by scripts/manifest.mjs after a hunt. Read-only; no user input touches the path.
export async function GET() {
  try {
    const path = join(process.cwd(), "applications", "manifest.json");
    const raw = await readFile(path, "utf8");
    const manifest = JSON.parse(raw);
    return NextResponse.json(manifest, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // No hunt run yet (or manifest missing) — return an empty, well-formed payload.
    return NextResponse.json({ generatedAt: null, count: 0, applications: [] });
  }
}
