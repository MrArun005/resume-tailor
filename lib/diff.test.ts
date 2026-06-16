import { describe, it, expect } from "vitest";
import { diffResume } from "./diff";
import type { ResumeContent } from "./content";

const base: ResumeContent = {
  name: "Arun",
  headline: "Engineer",
  contact: ["arun@example.com"],
  sections: [
    {
      title: "Experience",
      blocks: [
        { heading: "Engineer — Acme", subheading: "2021", text: "", bullets: ["Cut latency 40%", "Owned billing"] },
      ],
    },
    {
      title: "Education",
      blocks: [{ heading: "B.E. CS", subheading: "", text: "", bullets: [] }],
    },
  ],
};

function clone(c: ResumeContent): ResumeContent {
  return JSON.parse(JSON.stringify(c));
}

describe("diffResume", () => {
  it("reports no changes for identical content", () => {
    const d = diffResume(base, clone(base));
    expect(d.added).toBe(0);
    expect(d.removed).toBe(0);
    expect(d.sections.every((s) => !s.changed)).toBe(true);
  });

  it("detects an added bullet", () => {
    const target = clone(base);
    target.sections[0].blocks[0].bullets.push("Mentored 4 engineers");
    const d = diffResume(base, target);
    expect(d.added).toBe(1);
    expect(d.removed).toBe(0);
    const exp = d.sections.find((s) => s.title === "Experience")!;
    expect(exp.changed).toBe(true);
    expect(exp.lines.some((l) => l.op === "add" && l.text.includes("Mentored 4 engineers"))).toBe(true);
  });

  it("detects a removed bullet", () => {
    const target = clone(base);
    target.sections[0].blocks[0].bullets = ["Cut latency 40%"];
    const d = diffResume(base, target);
    expect(d.removed).toBe(1);
    expect(d.added).toBe(0);
  });

  it("treats a reworded line as a remove + add", () => {
    const target = clone(base);
    target.sections[0].blocks[0].bullets[0] = "Cut p99 latency by 40%";
    const d = diffResume(base, target);
    expect(d.added).toBe(1);
    expect(d.removed).toBe(1);
  });

  it("marks a brand-new section as all additions", () => {
    const target = clone(base);
    target.sections.push({
      title: "Skills",
      blocks: [{ heading: "", subheading: "", text: "Node.js, AWS", bullets: [] }],
    });
    const d = diffResume(base, target);
    const skills = d.sections.find((s) => s.title === "Skills")!;
    expect(skills.changed).toBe(true);
    expect(skills.lines.every((l) => l.op === "add")).toBe(true);
  });

  it("marks a removed section as all deletions", () => {
    const target = clone(base);
    target.sections = target.sections.filter((s) => s.title !== "Education");
    const d = diffResume(base, target);
    const edu = d.sections.find((s) => s.title === "Education")!;
    expect(edu.changed).toBe(true);
    expect(edu.lines.every((l) => l.op === "del")).toBe(true);
  });
});
