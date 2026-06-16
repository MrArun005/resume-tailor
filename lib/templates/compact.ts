import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 9.5pt; line-height: 1.3; }
.rt-head { margin-bottom: 7pt; }
.rt-name { font-size: 16pt; font-weight: 700; margin: 0; }
.rt-headline { color: #374151; margin-top: 1pt; font-size: 10pt; }
.rt-contact { font-size: 8.5pt; color: #4b5563; margin-top: 2pt; }
.rt-sec { margin-top: 8pt; }
.rt-sec-title { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #9ca3af; padding-bottom: 1pt; margin: 0 0 4pt; }
.rt-entry { margin-bottom: 5pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 6pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #6b7280; white-space: nowrap; font-size: 8.5pt; }
.rt-text { margin: 1pt 0; }
.rt-bullets { margin: 2pt 0 0; padding-left: 14pt; }
.rt-bullets li { margin: 1pt 0; }
`.trim();

export const compactTemplate: Template = {
  id: "compact",
  label: "Compact",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
