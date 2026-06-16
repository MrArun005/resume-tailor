#!/usr/bin/env node
/**
 * Standalone résumé-tailoring agent (headless CLI).
 *
 * Unlike the Claude Code skill (which uses the session model), this runs anywhere
 * Node + an ANTHROPIC_API_KEY are available — CI, a cron job, a server. It reuses
 * the same prompts and template renderers as the web app.
 *
 *   pnpm tailor --resume me.pdf --jd job.txt [--template classic|modern|compact|mirror]
 *               [--custom "led a team of 6; AWS certified"] [--out out.html] [--model <id>]
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_PROMPT, buildTailorInput } from "../lib/ai/prompts";
import { ResumeContentSchema, extractJson } from "../lib/content";
import { getTemplate, type TemplateId } from "../lib/templates";
import { normalizeResumeHtml } from "../lib/templates/layout";
import { coverage, resumeText } from "../lib/ats";

type Args = {
  resume?: string;
  jd?: string;
  template: TemplateId;
  custom: string;
  out?: string;
  model: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { template: "classic", custom: "", model: "claude-opus-4-8" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--resume") args.resume = next();
    else if (a === "--jd") args.jd = next();
    else if (a === "--template") args.template = next() as TemplateId;
    else if (a === "--custom") args.custom = next() ?? "";
    else if (a === "--out") args.out = next();
    else if (a === "--model") args.model = next() ?? args.model;
  }
  return args;
}

// Read an argument that's either an inline string or a path to a file.
function readMaybeFile(value: string): string {
  try {
    return readFileSync(value, "utf8");
  } catch {
    return value; // treat as inline text
  }
}

// One model turn → the concatenated text of the response (thinking blocks dropped).
// Streams because the responses contain full HTML documents and can be large.
async function ask(
  client: Anthropic,
  model: string,
  content: Anthropic.MessageParam["content"]
): Promise<string> {
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.resume || !args.jd) {
    console.error(
      "Usage: pnpm tailor --resume <file.pdf|file.txt> --jd <file|text> " +
        "[--template classic|modern|compact|mirror] [--custom <text>] [--out <file.html>] [--model <id>]"
    );
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in your environment first.");
    process.exit(1);
  }

  const client = new Anthropic();
  const jobDescription = readMaybeFile(args.jd);

  // 1. Analyze — reconstruct structured content (+ a faithful HTML mirror).
  console.error("[tailor-cli] analyzing résumé…");
  const isPdf = args.resume.toLowerCase().endsWith(".pdf");
  const analyzeContent: Anthropic.MessageParam["content"] = isPdf
    ? [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: readFileSync(args.resume).toString("base64"),
          },
        },
        { type: "text", text: ANALYZE_PROMPT },
      ]
    : [
        {
          type: "text",
          text: `${ANALYZE_PROMPT}\n\n=== RESUME TEXT ===\n${readFileSync(args.resume, "utf8")}`,
        },
      ];

  const analyzeRaw = await ask(client, args.model, analyzeContent);
  const analyzed = extractJson(analyzeRaw) as { content?: unknown; templateHtml?: unknown };
  const baseContent = ResumeContentSchema.parse(analyzed.content ?? {});
  const mirrorHtml =
    typeof analyzed.templateHtml === "string" ? normalizeResumeHtml(analyzed.templateHtml) : "";

  // 2. Tailor — rewrite the content for the job (honoring customization).
  console.error("[tailor-cli] tailoring to the job description…");
  const tailorRaw = await ask(client, args.model, [
    {
      type: "text",
      text: buildTailorInput({
        content: baseContent,
        templateHtml: mirrorHtml,
        jobDescription,
        customization: args.custom,
      }),
    },
  ]);
  const tailored = extractJson(tailorRaw) as {
    tailoredContent?: unknown;
    tailoredHtml?: unknown;
    changes?: unknown;
    keywords?: unknown;
  };
  const finalContent = ResumeContentSchema.parse(tailored.tailoredContent ?? baseContent);
  const changes = Array.isArray(tailored.changes)
    ? tailored.changes.filter((c): c is string => typeof c === "string")
    : [];

  // 3. Render into the chosen layout.
  let html: string;
  if (args.template === "mirror") {
    html =
      typeof tailored.tailoredHtml === "string" && tailored.tailoredHtml.trim()
        ? normalizeResumeHtml(tailored.tailoredHtml)
        : mirrorHtml;
  } else {
    const tpl = getTemplate(args.template);
    if (!tpl) {
      console.error(`Unknown template "${args.template}". Use classic | modern | compact | mirror.`);
      process.exit(1);
    }
    html = tpl.render(finalContent);
  }

  const outPath = args.out ?? `${(finalContent.name || "resume").replace(/[^a-z0-9-_]+/gi, "_")}-tailored.html`;
  writeFileSync(outPath, html);

  console.error(`\n[tailor-cli] wrote ${outPath} (template: ${args.template})`);
  if (changes.length) {
    console.error("\nWhat changed:");
    for (const c of changes) console.error(`  • ${c}`);
  }

  // ATS keyword coverage report.
  const kw = Array.isArray(tailored.keywords)
    ? tailored.keywords.filter((k): k is string => typeof k === "string")
    : [];
  if (kw.length) {
    const cov = coverage(kw, resumeText(finalContent));
    console.error(`\nATS keyword match: ${cov.score}% (${cov.covered.length}/${cov.total})`);
    if (cov.missing.length) {
      console.error("Missing — add the genuinely true ones via --custom and re-run:");
      console.error(`  ${cov.missing.join(", ")}`);
    }
  }

  console.error("\nFor a PDF: open the HTML in a browser and Print → Save as PDF (margins are baked in).");
}

main().catch((err) => {
  console.error("[tailor-cli] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
