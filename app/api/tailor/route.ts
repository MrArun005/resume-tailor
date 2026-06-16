import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";
import type { ProviderName, Tier } from "@/lib/ai/types";
import { buildTailorInput } from "@/lib/ai/prompts";
import { ResumeContentSchema, extractJson } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, templateHtml, jobDescription } = body;
    const customization: string = typeof body.customization === "string" ? body.customization : "";
    const tier: Tier = body.tier === "best" ? "best" : "fast";
    const pref: ProviderName | undefined = body.provider;

    if (!templateHtml || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Missing resume template or job description." },
        { status: 400 }
      );
    }

    // Size caps (anti-DoS) on free-text + template inputs.
    if (
      String(jobDescription).length > 100_000 ||
      customization.length > 50_000 ||
      String(templateHtml).length > 3_000_000
    ) {
      return NextResponse.json({ error: "Input too large." }, { status: 413 });
    }

    const provider = getProvider(pref);
    console.log(`[tailor] start · provider=${provider.name} tier=${tier} jd=${jobDescription.length}ch`);

    const prompt = buildTailorInput({ content, templateHtml, jobDescription, customization });
    const raw = await provider.generate({ prompt, tier });
    console.log(`[tailor] model returned ${raw.length} chars`);

    const parsed = extractJson(raw) as {
      tailoredContent?: unknown;
      tailoredHtml?: unknown;
      changes?: unknown;
    };
    console.log(
      `[tailor] parsed · html=${typeof parsed.tailoredHtml === "string" ? parsed.tailoredHtml.length + "ch" : "missing"} changes=${Array.isArray(parsed.changes) ? parsed.changes.length : 0}`
    );

    const tailoredContent = ResumeContentSchema.parse(parsed.tailoredContent ?? content ?? {});
    const tailoredHtml =
      typeof parsed.tailoredHtml === "string" && parsed.tailoredHtml.trim()
        ? parsed.tailoredHtml
        : templateHtml;
    const changes = Array.isArray(parsed.changes)
      ? parsed.changes.filter((c): c is string => typeof c === "string")
      : [];

    return NextResponse.json({
      tailoredContent,
      tailoredHtml,
      changes,
      engine: { provider: provider.name, model: provider.modelFor(tier) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed.";
    console.error("[tailor] FAILED:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
