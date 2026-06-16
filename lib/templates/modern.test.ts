import { describe, it, expect } from "vitest";
import { modernTemplate } from "./modern";
import { SAMPLE } from "./__fixtures__/sample";

describe("modernTemplate", () => {
  const html = modernTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(modernTemplate.id).toBe("modern");
    expect(modernTemplate.label).toBe("Modern");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
  });

  it("renders escaped content and uses a sans-serif font with an accent color", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Owned billing services");
    expect(html).toMatch(/Helvetica|Arial/i);
    expect(html).toMatch(/#1f3a5f/i);
  });
});
