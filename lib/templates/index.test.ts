import { describe, it, expect } from "vitest";
import { TEMPLATES, getTemplate } from "./index";

describe("template registry", () => {
  it("lists the three code templates in order", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "modern", "compact"]);
  });

  it("resolves a code template by id", () => {
    expect(getTemplate("modern")?.label).toBe("Modern");
  });

  it("returns null for the mirror id (not a code template)", () => {
    expect(getTemplate("mirror")).toBeNull();
  });
});
