import { describe, it, expect } from "vitest";
import { compactTemplate } from "./compact";
import { SAMPLE } from "./__fixtures__/sample";

describe("compactTemplate", () => {
  const html = compactTemplate.render(SAMPLE);

  it("has the expected id and label", () => {
    expect(compactTemplate.id).toBe("compact");
    expect(compactTemplate.label).toBe("Compact");
  });

  it("produces a complete document with print CSS", () => {
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toMatch(/@page[^}]*margin:\s*1\.25cm/i);
  });

  it("renders content with a small base font for density", () => {
    expect(html).toContain("Arun &lt;Test&gt; Mallikarjun");
    expect(html).toContain("Cut latency 40%");
    expect(html).toMatch(/font-size:\s*9\.5pt/i);
  });
});
