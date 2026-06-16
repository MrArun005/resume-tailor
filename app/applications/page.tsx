"use client";

import { useCallback, useEffect, useState } from "react";

type Application = {
  code: string;
  company: string;
  role: string;
  applyUrl: string;
  match: number | null;
  posted: string;
  salary: string;
  status: string;
  hasResume: boolean;
  hasCover: boolean;
  resumeFile: string;
  coverFile: string;
};
type Manifest = { generatedAt: string | null; count: number; applications: Application[] };

const STATUS_STYLE: Record<string, string> = {
  applied: "bg-[var(--accent-soft)] text-[var(--accent-deep)]",
  interview: "bg-[var(--verify-soft)] text-[var(--verify)]",
  offer: "bg-[var(--verify)] text-white",
  saved: "bg-[var(--paper-2)] text-[var(--ink-soft)]",
  rejected: "bg-[var(--line)] text-[var(--muted)]",
  dropped: "bg-[var(--line)] text-[var(--muted)]",
};

const fileUrl = (code: string, kind: string, inline = false) =>
  `/api/applications/file?code=${encodeURIComponent(code)}&kind=${kind}${inline ? "&inline=1" : ""}`;

export default function ApplicationsPage() {
  const [data, setData] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/applications", { cache: "no-store" });
      setData(await res.json());
    } catch {
      setError("Could not load applications.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const copyResume = useCallback(async (code: string) => {
    try {
      const res = await fetch(fileUrl(code, "text"));
      if (!res.ok) throw new Error();
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      setError("Copy failed — your browser may block clipboard access.");
    }
  }, []);

  const apps = data?.applications ?? [];

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] px-6 py-10" style={{ fontFamily: "var(--font-body)" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Your applications
            </h1>
            <p className="mt-1 text-[var(--muted)]">
              {data?.generatedAt ? `Prepared ${data.generatedAt} · ` : ""}
              {apps.length} ready to send — résumé + cover letter per role.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <button onClick={load} className="rounded-full border border-[var(--line-strong)] px-4 py-2 hover:bg-[var(--card)]">
              ↻ Refresh
            </button>
            <a href="/" className="rounded-full border border-[var(--line-strong)] px-4 py-2 hover:bg-[var(--card)]">
              ← Tailor a résumé
            </a>
          </div>
        </header>

        {error && <div className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-[var(--accent-deep)]">{error}</div>}

        {apps.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-10 text-center text-[var(--muted)]">
            <p className="text-lg">No prepared applications yet.</p>
            <p className="mt-2 text-sm">
              Run a hunt with the <code className="font-mono">job-hunt</code> skill, then{" "}
              <code className="font-mono">node .claude/skills/job-hunt/scripts/manifest.mjs</code> to populate this view.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]" style={{ boxShadow: "var(--shadow)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--line-strong)] text-left text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Match</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Posted</th>
                  <th className="px-4 py-3 font-medium">Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Apply &amp; résumé</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.code} className="border-b border-[var(--line)] last:border-0 align-top hover:bg-[var(--paper-2)]/40">
                    <td className="px-4 py-4">
                      <span className="font-mono text-base font-semibold">{a.match != null ? `${a.match}%` : "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[var(--ink)]">{a.company}</div>
                      <div className="text-[var(--ink-soft)]">{a.role}</div>
                      <div className="mt-0.5 font-mono text-xs text-[var(--muted)]">{a.code}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-[var(--ink-soft)]">{a.posted || "—"}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-[var(--ink-soft)]">{a.salary || "—"}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[a.status] || STATUS_STYLE.saved}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.applyUrl ? (
                          <a
                            href={a.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white hover:bg-[var(--accent-deep)]"
                          >
                            Apply ↗
                          </a>
                        ) : (
                          <span className="rounded-lg bg-[var(--paper-2)] px-3 py-1.5 text-[var(--muted)]">no link</span>
                        )}
                        <a href={fileUrl(a.code, "resume")} className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 hover:bg-[var(--paper-2)]">
                          ⬇ Résumé
                        </a>
                        <button
                          onClick={() => copyResume(a.code)}
                          className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 hover:bg-[var(--paper-2)]"
                          title="Copy the résumé as text — paste into application forms"
                        >
                          {copied === a.code ? "Copied ✓" : "⧉ Copy"}
                        </button>
                        <a href={fileUrl(a.code, "resume", true)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 hover:bg-[var(--paper-2)]">
                          View
                        </a>
                        {a.hasCover && (
                          <a href={fileUrl(a.code, "cover")} className="rounded-lg border border-[var(--line-strong)] px-3 py-1.5 text-[var(--ink-soft)] hover:bg-[var(--paper-2)]">
                            ⬇ Cover
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--muted)]">
          <strong>⬇ Résumé / Cover</strong> downloads the PDF to attach on the application form. <strong>⧉ Copy</strong> copies the résumé
          as text for &ldquo;paste your résumé&rdquo; fields (browsers can&rsquo;t reliably copy a binary file to the clipboard).
        </p>
      </div>
    </main>
  );
}
