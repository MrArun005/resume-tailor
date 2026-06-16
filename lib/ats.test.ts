import { describe, it, expect } from "vitest";
import { coverage, resumeText } from "./ats";
import type { ResumeContent } from "./content";

const sample: ResumeContent = {
  name: "Arun",
  headline: "Backend Engineer",
  contact: ["arun@example.com"],
  sections: [
    {
      title: "Experience",
      blocks: [
        {
          heading: "Engineer — Acme",
          subheading: "2021",
          text: "",
          bullets: ["Built scalable REST APIs in Node.js", "Integrated the Gemini API into production"],
        },
      ],
    },
  ],
};

describe("resumeText", () => {
  it("flattens headings, bullets, and headline into one searchable string", () => {
    const t = resumeText(sample);
    expect(t).toContain("Backend Engineer");
    expect(t).toContain("REST APIs");
    expect(t).toContain("Gemini API");
  });
});

describe("coverage", () => {
  it("splits keywords into covered vs missing", () => {
    const r = coverage(["Node.js", "REST APIs", "Kubernetes", "multi-agent systems"], resumeText(sample));
    expect(r.covered).toEqual(expect.arrayContaining(["Node.js", "REST APIs"]));
    expect(r.missing).toEqual(expect.arrayContaining(["Kubernetes", "multi-agent systems"]));
  });

  it("matches case-insensitively and tolerates punctuation like Node.js", () => {
    const r = coverage(["NODE.JS", "rest apis"], resumeText(sample));
    expect(r.missing).toHaveLength(0);
    expect(r.covered).toHaveLength(2);
  });

  it("computes a percentage score and total", () => {
    const r = coverage(["Node.js", "Kubernetes"], resumeText(sample));
    expect(r.total).toBe(2);
    expect(r.score).toBe(50);
  });

  it("dedupes keywords that normalize to the same token", () => {
    const r = coverage(["Node.js", "node.js", "NODE.JS"], resumeText(sample));
    expect(r.total).toBe(1);
  });

  it("returns score 0 for an empty keyword list", () => {
    const r = coverage([], resumeText(sample));
    expect(r.score).toBe(0);
    expect(r.total).toBe(0);
  });

  // Concept-based matching: the JD's wording often differs from the résumé's.
  const conceptResume: ResumeContent = {
    name: "X",
    headline: "",
    contact: [],
    sections: [
      {
        title: "Experience",
        blocks: [
          {
            heading: "",
            subheading: "",
            text: "Reviewed code and mentored engineers. Resolved bottlenecks across distributed microservices. Deployed on AWS and GCP. Built data ingestion pipelines.",
            bullets: [],
          },
        ],
      },
    ],
  };

  it("matches concepts phrased differently (not just exact substrings)", () => {
    const r = coverage(
      ["code review", "distributed systems", "cloud services"],
      resumeText(conceptResume)
    );
    expect(r.missing).toHaveLength(0);
  });

  it("stems word forms so plurals/verb endings still match", () => {
    const r = coverage(["data pipeline", "crawl"], resumeText(conceptResume));
    // "pipelines" in text matches "data pipeline"; "crawl" is genuinely absent.
    expect(r.covered).toContain("data pipeline");
    expect(r.missing).toContain("crawl");
  });
});
