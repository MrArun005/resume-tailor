"use client";

import type { ResumeDiff } from "@/lib/diff";

// Renders a ResumeDiff as a per-section list of added (green) / removed (red) lines.
export function DiffView({ diff }: { diff: ResumeDiff }) {
  const changed = diff.sections.filter((s) => s.changed);
  if (!changed.length) {
    return (
      <p className="micro" style={{ marginTop: 6 }}>
        No differences between these two versions.
      </p>
    );
  }
  return (
    <div>
      <p className="micro" style={{ margin: "6px 0 10px", letterSpacing: "0.08em" }}>
        {diff.added} added · {diff.removed} removed
      </p>
      {changed.map((s) => (
        <div key={s.title} style={{ marginBottom: 12 }}>
          <div className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-soft)", marginBottom: 4 }}>
            {s.title}
          </div>
          {s.lines
            .filter((l) => l.op !== "same")
            .map((l, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 13,
                  lineHeight: 1.45,
                  padding: "2px 8px",
                  borderRadius: 5,
                  marginBottom: 2,
                  color: l.op === "add" ? "var(--verify)" : "var(--accent-deep)",
                  background:
                    l.op === "add" ? "rgba(34,139,87,0.08)" : "rgba(176,58,46,0.07)",
                }}
              >
                <span className="font-mono" style={{ flexShrink: 0 }}>
                  {l.op === "add" ? "+" : "−"}
                </span>
                <span>{l.text}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
