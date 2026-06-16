import type { Template } from "./types";
import { documentShell, renderBody } from "./layout";

const css = `
body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 11pt; line-height: 1.4; }
.rt-head { text-align: center; margin-bottom: 10pt; }
.rt-name { font-size: 20pt; font-weight: 700; margin: 0; letter-spacing: .02em; }
.rt-headline { font-style: italic; color: #444; margin-top: 2pt; }
.rt-contact { font-size: 9.5pt; color: #444; margin-top: 4pt; }
.rt-sec { margin-top: 12pt; }
.rt-sec-title { font-size: 12pt; text-transform: uppercase; letter-spacing: .08em; text-align: center; border-bottom: 1px solid #000; padding-bottom: 2pt; margin: 0 0 6pt; }
.rt-entry { margin-bottom: 8pt; }
.rt-entry-head { display: flex; justify-content: space-between; gap: 8pt; align-items: baseline; }
.rt-heading { font-weight: 700; }
.rt-sub { color: #555; font-style: italic; white-space: nowrap; }
.rt-text { margin: 2pt 0; }
.rt-bullets { margin: 3pt 0 0; padding-left: 16pt; }
.rt-bullets li { margin: 1.5pt 0; }
`.trim();

export const classicTemplate: Template = {
  id: "classic",
  label: "Classic",
  render: (content) => documentShell({ bodyCss: css, bodyHtml: renderBody(content) }),
};
