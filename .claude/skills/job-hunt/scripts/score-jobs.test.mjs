// Regression test for the match scorer. Self-contained — run with:
//   node --test .claude/skills/job-hunt/scripts/score-jobs.test.mjs
// No vitest / deps; uses Node's built-in test runner + a temp fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "score-jobs.mjs");
const SKILLS = "react,node.js,typescript,next.js,llm,ai,full-stack,postgresql,microservices,python";

function score(jobs) {
  const dir = mkdtempSync(join(tmpdir(), "score-"));
  const f = join(dir, "jobs.json");
  writeFileSync(f, JSON.stringify(jobs));
  try {
    execFileSync("node", [SCRIPT, "--jobs", f, "--skills", SKILLS], { stdio: "pipe" });
    return JSON.parse(readFileSync(f, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("ranks a matching full-stack/AI role above an unrelated one", () => {
  const out = score([
    { title: "Office Administrator", company: "X", url: "u1",
      description: "Filing, scheduling, answering phones. No technical work." },
    { title: "Senior Full-Stack Engineer", company: "Y", url: "u2",
      description: "Build with React, Node.js, TypeScript, Next.js and Postgres. Ship LLM/AI features across microservices." },
  ]);
  assert.equal(out[0].url, "u2", "the relevant role should rank first");
  assert.ok(out[0].match > out[1].match, "matching role scores higher");
  assert.ok(out[0].match >= 60, `expected a strong match, got ${out[0].match}`);
  assert.ok(Array.isArray(out[0].matchWhy) && out[0].matchWhy.length > 0, "matchWhy lists the matched skills");
});

test("short skills don't false-match inside other words (boundary matching)", () => {
  // 'ai' must not match 'maintain'/'available'; 'node' must not match 'anode'.
  const out = score([
    { title: "Maintenance Coordinator", company: "Z", url: "u3",
      description: "Maintain availability of anode equipment; coordinate repairs. Position requires patience." },
  ]);
  assert.ok(!out[0].matchWhy.includes("ai"), "'ai' should not match inside 'maintain'/'available'");
  assert.ok(!out[0].matchWhy.includes("node"), "'node' should not match inside 'anode'");
});
