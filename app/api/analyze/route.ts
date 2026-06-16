import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";
import type { ProviderName, Tier } from "@/lib/ai/types";
import { ANALYZE_PROMPT } from "@/lib/ai/prompts";
import { ResumeContentSchema, extractJson } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pdfBase64: string | undefined = body.pdfBase64;
    const tier: Tier = body.tier === "best" ? "best" : "fast";
    const pref: ProviderName | undefined = body.provider;

    if (!pdfBase64) {
      return NextResponse.json({ error: "Missing pdfBase64." }, { status: 400 });
    }

    const provider = getProvider(pref);
    console.log(`[analyze] start · provider=${provider.name} tier=${tier} pdf=${pdfBase64.length}b64`);
    const raw = await provider.generate({ prompt: ANALYZE_PROMPT, tier, pdfBase64 });
    console.log(`[analyze] model returned ${raw.length} chars`);

    const parsed = extractJson(raw) as { content?: unknown; templateHtml?: unknown };
    const content = ResumeContentSchema.parse(parsed.content ?? {});
    const templateHtml = typeof parsed.templateHtml === "string" ? parsed.templateHtml : "";

    if (!templateHtml) {
      return NextResponse.json(
        { error: "The model could not reconstruct the resume layout. Try the Best tier." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      content,
      templateHtml,
      engine: { provider: provider.name, model: provider.modelFor(tier) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    console.error("[analyze] FAILED:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
