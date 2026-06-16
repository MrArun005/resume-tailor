#!/usr/bin/env node
// Cover-letter renderer — turns the tailored letter prose (written by the skill)
// into a clean, print-ready HTML letter that matches the résumé's look. Convert to
// PDF with topdf.mjs, the same way as a résumé. No dependencies.
//
//   node cover.mjs --body-file letter.txt --name "Arun Mallikarjuna" \
//     --contact "arun@x.com, +91 …, Bengaluru" [--company Acme] [--role "Senior Engineer"] \
//     [--date 2026-06-16] --out cover.html
//
// The --body-file holds just the letter body (salutation … sign-off); blank lines
// separate paragraphs. The letterhead (name + contact) and date are added here.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[++i];

const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

if (!args["body-file"]) { console.error("Usage: node cover.mjs --body-file letter.txt --name … --contact … [--company …] [--role …] [--out cover.html]"); process.exit(1); }
const NAME = args.name || "";
const CONTACT = (args.contact || "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = args.out || "cover.html";
const body = readFileSync(args["body-file"], "utf8").trim();

// Paragraphs separated by blank lines; single newlines become <br> (sign-off blocks).
const paras = body.split(/\n\s*\n/).map((p) => `<p class="cl-p">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
const subjectLine = args.role || args.company ? `<p class="cl-subject"><strong>Re: ${escapeHtml([args.role, args.company].filter(Boolean).join(" — "))}</strong></p>` : "";

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { size: Letter; margin: 1.9cm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; }
.cl-head { border-bottom: 1px solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
.cl-name { font-size: 19pt; font-weight: 700; letter-spacing: .02em; margin: 0; }
.cl-contact { font-size: 9.5pt; color: #444; margin-top: 4pt; }
.cl-date { color: #444; margin: 0 0 12pt; font-size: 10pt; }
.cl-subject { margin: 0 0 12pt; }
.cl-p { margin: 0 0 10pt; orphans: 2; widows: 2; }
</style>
</head>
<body>
<header class="cl-head">
  ${NAME ? `<h1 class="cl-name">${escapeHtml(NAME)}</h1>` : ""}
  ${CONTACT.length ? `<div class="cl-contact">${CONTACT.map(escapeHtml).join(" &middot; ")}</div>` : ""}
</header>
${args.date ? `<p class="cl-date">${escapeHtml(args.date)}</p>` : ""}
${subjectLine}
${paras}
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`Saved cover letter to: ${resolve(OUT)}`);
