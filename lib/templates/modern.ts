import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.45; }
.rt-head { margin-bottom: 12pt; }
.rt-name { font-size: 22pt; font-weight: 700; margin: 0; color: #1f3a5f; }
.rt-headline { color: #374151; margin-top: 2pt; font-size: 11pt; }
.rt-contact { font-size: 9.5pt; color: #4b5563; margin-top: 5pt; }
.rt-sec { margin-top: 13pt; }
.rt-sec-title { font-size: 11pt; text-transform: uppercase; letter-spacing: .1em; color: #1f3a5f; border-bottom: 2px solid #1f3a5f; padding-bottom: 2pt; margin: 0 0 6pt; }
.rt-entry { margin-bottom: 9pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #6b7280; white-space: nowrap; font-size: 9.5pt; }
.rt-text { margin: 2pt 0; }
.rt-bullets { margin: 3pt 0 0; padding-left: 16pt; }
.rt-bullets li { margin: 2pt 0; }
`.trim();

export const modernTemplate: Template = {
  id: "modern",
  label: "Modern",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
