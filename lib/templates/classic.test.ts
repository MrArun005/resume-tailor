import { describe, it, expect } from "vitest";
import { classicTemplate } from "./classic";
import { SAMPLE } from "./__fixtures__/sample";

describe("classicTemplate", () => {
  const html = classicTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(classicTemplate.id).toBe("classic");
    expect(classicTemplate.label).toBe("Classic");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
    expect(html).toMatch(/break-inside:\s*avoid/i);
  });

  it("renders escaped content and uses a serif font", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Experience");
    expect(html).toContain("Cut latency 40%");
    expect(html).toMatch(/Georgia/i);
  });
});
