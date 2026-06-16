import type { ResumeContent } from "@/lib/content";

export type TemplateId = "mirror" | "classic" | "modern" | "compact";

export interface Template {
  id: TemplateId;
  label: string;
  render(content: ResumeContent): string;
}
