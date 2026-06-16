import { z } from "zod";

export const BlockSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
  text: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const SectionSchema = z.object({
  title: z.string().default(""),
  blocks: z.array(BlockSchema).default([]),
});

export const ResumeContentSchema = z.object({
  name: z.string().default(""),
  headline: z.string().default(""),
  contact: z.array(z.string()).default([]),
  sections: z.array(SectionSchema).default([]),
});

export type ResumeContent = z.infer<typeof ResumeContentSchema>;

/** Pull a JSON object out of a model response that may be fenced or have stray prose. */
export function extractJson(raw: string): unknown {
  let s = raw.trim();
  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return a JSON object.");
  }
  return JSON.parse(s.slice(start, end + 1));
}

export function contentToText(c: ResumeContent): string {
  const lines: string[] = [];
  if (c.name) lines.push(c.name);
  if (c.headline) lines.push(c.headline);
  if (c.contact.length) lines.push(c.contact.join("  |  "));
  for (const section of c.sections) {
    lines.push("", (section.title || "").toUpperCase());
    lines.push("=".repeat(Math.max((section.title || "").length, 3)));
    for (const b of section.blocks) {
      if (b.heading) lines.push("", b.heading);
      if (b.subheading) lines.push(b.subheading);
      if (b.text) lines.push(b.text);
      for (const bullet of b.bullets) lines.push(`  - ${bullet}`);
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function contentToMarkdown(c: ResumeContent): string {
  const lines: string[] = [];
  if (c.name) lines.push(`# ${c.name}`);
  if (c.headline) lines.push(`*${c.headline}*`);
  if (c.contact.length) lines.push(c.contact.join(" · "));
  for (const section of c.sections) {
    lines.push("", `## ${section.title}`);
    for (const b of section.blocks) {
      const head = [b.heading, b.subheading].filter(Boolean).join(" — ");
      if (head) lines.push("", `### ${head}`);
      if (b.text) lines.push("", b.text);
      for (const bullet of b.bullets) lines.push(`- ${bullet}`);
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
