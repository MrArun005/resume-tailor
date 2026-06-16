export const ANALYZE_PROMPT = `You are a resume parsing and layout-reconstruction engine. You are given a candidate's resume as a PDF. Return a SINGLE JSON object and nothing else, with exactly this shape:

{
  "content": {
    "name": string,
    "headline": string,          // the title/tagline under the name; "" if none
    "contact": string[],         // each contact/link item shown (email, phone, location, LinkedIn, portfolio, etc.)
    "sections": [
      {
        "title": string,         // section heading EXACTLY as written, e.g. "PROFESSIONAL EXPERIENCE"
        "blocks": [
          {
            "heading": string,    // primary line: role + company, project name, or skill category; "" if none
            "subheading": string, // secondary line: dates, location, tech stack; "" if none
            "text": string,       // paragraph text such as a summary; "" if none
            "bullets": string[]   // bullet points; [] if none
          }
        ]
      }
    ]
  },
  "templateHtml": string
}

Rules for "content":
- Transcribe the resume verbatim. Do not summarize, add, or omit anything.
- Preserve the original section order and the original ordering within sections.

Rules for "templateHtml" — a COMPLETE, self-contained HTML document that visually reproduces the uploaded resume as faithfully as possible:
- Start with <!doctype html>. All CSS goes in a single inline <style> tag. NO external resources, NO <script>, NO web-font links. Use system font stacks that match the look (e.g. Georgia/"Times New Roman" serif, or Helvetica/Arial sans-serif).
- Match the original design precisely: page geometry (US Letter, portrait — the .page fills the printable area; the page margins are handled by @page, so do NOT add your own page padding/margin to .page), section-heading style (color, uppercase, letter-spacing, underline rules/borders), font families and sizes, text colors, line spacing, bullet style, single- vs two-column layout, and right-aligned dates if the original right-aligns them.
- Reproduce typographic detail faithfully: detect whether the original is serif or sans-serif and pick a matching system font stack; preserve bold/italic emphasis exactly where the original uses it; reproduce horizontal divider rules; keep section headings and their casing/wording identical to the source.
- Do NOT add, remove, summarize, or reorder any content — the rendered text must match the resume verbatim, only its presentation is reconstructed.
- Fill it with the SAME content as the original resume (verbatim), wrapping each editable text run in a semantic element so the structure mirrors "content".
- It MUST print cleanly to PDF: use pt/in/px units (never vw/vh), set body { margin: 0 }, and include "-webkit-print-color-adjust: exact; print-color-adjust: exact;" so colors render.
- PAGE MARGINS — this is critical. Set "@page { size: Letter; margin: 1.25cm }" so EVERY page (including the 2nd and later) gets an identical 1.25cm margin on all four sides. Do NOT recreate margins with padding on .page — that only pads the first/last page. The .page container must be margin: 0 and padding: 0 with width: 100% so it simply fills the area @page leaves.
- PAGINATION — this is critical. Use a SINGLE continuous .page container with NO fixed height, and DO NOT split the content into multiple fixed-height "page" cards. The content flows in one column and the PDF engine handles page breaks automatically inside the @page margins.
- To prevent ugly breaks, every entry/block container (each role, project, education item, etc. — together with its heading, subheading, and ALL its bullets) MUST carry "break-inside: avoid; page-break-inside: avoid;" so an entry is never split across a page boundary. Every section and entry heading MUST carry "break-after: avoid; page-break-after: avoid;" so a heading never sits alone at the bottom of a page.
- Do NOT invent logos, photos, or imagery that are not in the original.

Return ONLY the JSON object.`;

export const TAILOR_PROMPT = `You are an expert resume writer and ATS-optimization specialist. Tailor a candidate's resume to a specific job description while preserving the EXACT visual design of their original resume.

You are given, below:
1. CONTENT — the candidate's structured resume content (JSON).
2. TEMPLATE_HTML — the exact, complete HTML document of their current resume.
3. JOB_DESCRIPTION — the target role.

Rewrite the resume so it aligns strongly with the job description:
- Mirror the JD's keywords, required skills, and terminology — but ONLY where it is truthful to the candidate's real experience.
- Lead bullets with impact and quantified outcomes; tighten weak or generic phrasing.
- Reorder and emphasize the most relevant experience, skills, and projects for this role.
- Surface latent, genuinely-held skills that the JD asks for.

HARD CONSTRAINTS (never violate):
- Do NOT invent or alter employers, job titles, dates, degrees, certifications, or technologies the candidate never listed.
- Every claim must be grounded in the original resume. You may rephrase, reframe, and reorder — never fabricate.

Return a SINGLE JSON object and nothing else:
{
  "tailoredContent": { /* same schema as CONTENT, with rewritten text */ },
  "tailoredHtml": string,   // the SAME document as TEMPLATE_HTML — identical <style>, classes, tags, and layout — with ONLY the visible resume text replaced by the tailored content. Do NOT change fonts, colors, spacing, margins, or structure.
  "changes": string[]       // 4-8 short, plain-language notes describing the most important tailoring changes, for the candidate to review
}

Return ONLY the JSON object.`;

export function buildTailorInput(args: {
  content: unknown;
  templateHtml: string;
  jobDescription: string;
}): string {
  return [
    TAILOR_PROMPT,
    "",
    "=== CONTENT ===",
    JSON.stringify(args.content),
    "",
    "=== TEMPLATE_HTML ===",
    args.templateHtml,
    "",
    "=== JOB_DESCRIPTION ===",
    args.jobDescription,
  ].join("\n");
}
