import type { Template, TemplateId } from "./types";
import { classicTemplate } from "./classic";
import { modernTemplate } from "./modern";
import { compactTemplate } from "./compact";

export const TEMPLATES: Template[] = [classicTemplate, modernTemplate, compactTemplate];

export function getTemplate(id: TemplateId): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export type { Template, TemplateId } from "./types";
