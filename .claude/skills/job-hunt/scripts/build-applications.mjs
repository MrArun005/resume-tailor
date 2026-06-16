#!/usr/bin/env node
// Bind everything together: read fetched jobs + the résumé variants in
// applications/resumes/, decide which résumé fits each job, write a single
// WHERE-TO-APPLY.md map (résumé ↔ job ↔ link), and generate a cold-email .eml
// draft (with the right résumé attached) for every job that exposed an email.
//
//   node build-applications.mjs [--jobs applications/jobs.json] [--dir applications] [--name "Arun Mallikarjuna"]
//
// Expects résumé PDFs in <dir>/resumes/ named "<Name> - <Variant>.pdf".

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[++i];
const DIR = args.dir || "applications";
const NAME = args.name || "Arun Mallikarjuna";
const jobs = JSON.parse(readFileSync(args.jobs || `${DIR}/jobs.json`, "utf8"));

// Résumé variants (PDF files in <dir>/resumes/). Label → filename + short tag.
const VARIANTS = {
  ai:       { label: "Full-Stack AI Engineer",      tag: "AI" },
  founding: { label: "Founding Engineer",            tag: "Founding" },
  systems:  { label: "Full-Stack Systems Engineer",  tag: "Systems" },
};
const pdfFor = (v) => `${DIR}/resumes/${NAME} - ${VARIANTS[v].label}.pdf`;

// Which résumé fits this job.
function pickVariant(job) {
  const t = (job.title || "").toLowerCase();
  const hay = `${job.title} ${job.company} ${job.description}`.toLowerCase();
  if (/founding|0\s*[→-]?\s*1|early[- ]?stage/.test(t)) return "founding";
  if (/(palo alto|jfrog|autodesk|infosys|tata|tcs|wipro|cgi|cognizant|accenture|capgemini|thomson reuters|taylor and francis|amagi)/.test(hay)
      || /\bjava\b|enterprise|\bstaff\b/.test(t)) return "systems";
  if (/\bai\b|\bml\b|llm|genai|agent/.test(hay)) return "ai";
  return "ai";
}

function buildEml(to, subject, body, attachPath, outPath) {
  const name = basename(attachPath);
  const b64 = readFileSync(attachPath).toString("base64").replace(/(.{76})/g, "$1\r\n");
  const bnd = `jh_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
  const CRLF = "\r\n";
  const eml = [
    `To: ${to}`, `Subject: ${subject}`, "X-Unsent: 1", "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${bnd}"`,
  ].join(CRLF) + CRLF + CRLF
    + `--${bnd}` + CRLF + `Content-Type: text/plain; charset="utf-8"` + CRLF + "Content-Transfer-Encoding: 8bit" + CRLF + CRLF
    + body.replace(/\r?\n/g, CRLF) + CRLF + CRLF
    + `--${bnd}` + CRLF + `Content-Type: application/pdf; name="${name}"` + CRLF
    + "Content-Transfer-Encoding: base64" + CRLF + `Content-Disposition: attachment; filename="${name}"` + CRLF + CRLF
    + b64 + CRLF + `--${bnd}--` + CRLF;
  writeFileSync(outPath, eml);
}

const recruiter = /peak hire|sourceright|merito|vdart|unnati|zinnov|lalitech|discoveries quintessential|rox data|recruit square/i;
const bigco = /tata|tcs|wipro|cgi|infosys|cognizant|accenture|capgemini|thomson reuters/i;
const fit = (c) => (recruiter.test(c) ? "⚠ recruiter" : bigco.test(c) ? "big-co" : "🔥 product");
const safe = (s) => s.replace(/[^a-z0-9 ()&._-]+/gi, " ").replace(/\s+/g, " ").trim();

mkdirSync(`${DIR}/drafts`, { recursive: true });

const rows = [];
let drafted = 0;
jobs.forEach((job, i) => {
  const v = pickVariant(job);
  const n = String(i + 1).padStart(2, "0");
  let draftCell = "—";
  if (job.email) {
    const pdf = pdfFor(v);
    if (existsSync(pdf)) {
      const out = `${DIR}/drafts/${n} - ${safe(job.company)}.eml`;
      const body = `Hi,\n\nI came across the ${job.title} opening at ${job.company} and wanted to reach out — it lines up closely with my background as a full-stack engineer (4+ years) building AI/LLM-powered products end to end.\n\nMy résumé is attached. Would you be open to a quick chat?\n\nBest,\n${NAME}\narunmallikarjun005@gmail.com · +91 74835 73363`;
      buildEml(job.email, `${job.title} — ${NAME}`, body, pdf, out);
      drafted++;
      draftCell = `[cold-email](drafts/${basename(out)})`;
    }
  }
  rows.push(`| ${n} | ${job.company} | ${job.title.replace(/\|/g, " ")} | ${job.location} | ${fit(job.company)} | **${VARIANTS[v].tag}** | ${job.email || "—"} | ${draftCell} | [apply](${job.url}) |`);
});

const md = `# Where to apply — ${jobs.length} roles

Generated for **${NAME}**. Each row maps the role to the **résumé** to send and the **apply link**.
Where a JD exposed an email, a ready cold-email draft is linked (open the \`.eml\`, review, send).

**Résumés** (in \`resumes/\`): **AI** = Full-Stack AI Engineer · **Founding** = Founding Engineer · **Systems** = Full-Stack Systems Engineer.

| # | Company | Role | Location | Fit | Résumé | Email | Cold-email | Link |
|---|---------|------|----------|-----|--------|-------|-----------|------|
${rows.join("\n")}

> ${drafted} cold-email draft(s) generated in \`drafts/\` (only for roles whose JD exposed an email).
`;
writeFileSync(`${DIR}/WHERE-TO-APPLY.md`, md);

console.log(`Bound ${jobs.length} jobs → ${resolve(DIR)}`);
console.log(`  WHERE-TO-APPLY.md (résumé↔job↔link map) · ${drafted} cold-email draft(s) in drafts/`);
const counts = jobs.reduce((m, j) => ((m[VARIANTS[pickVariant(j)].tag] = (m[VARIANTS[pickVariant(j)].tag] || 0) + 1), m), {});
console.log("  résumé assignment:", counts);
