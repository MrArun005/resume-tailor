"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewFrame } from "@/components/PreviewFrame";
import { TEMPLATES, getTemplate, type TemplateId } from "@/lib/templates";
import type { ResumeContent } from "@/lib/content";
import { diffResume, type ResumeDiff } from "@/lib/diff";
import { DiffView } from "@/components/DiffView";
import { coverage, resumeText } from "@/lib/ats";

type Tier = "fast" | "best";
type Phase = "idle" | "analyzing" | "analyzed" | "tailoring" | "done";
type Tab = "original" | "tailored";
type Engine = { provider: string; model: string };
type Version = {
  label: string;
  tailoredContent: unknown;
  tailoredHtml: string;
  changes: string[];
  customization: string;
  keywords: string[];
};

const EXPORTS: { fmt: "pdf" | "docx" | "txt" | "md"; label: string }[] = [
  { fmt: "pdf", label: "PDF" },
  { fmt: "docx", label: "Word" },
  { fmt: "txt", label: "Text" },
  { fmt: "md", label: "Markdown" },
];

const STORAGE_KEY = "tailorwright:v1";

type Persisted = {
  fileName: string;
  jd: string;
  custom: string;
  company: string;
  tier: Tier;
  templateHtml: string;
  content: unknown;
  tailoredHtml: string;
  tailoredContent: unknown;
  changes: string[];
  keywords: string[];
  engine: Engine | null;
  tab: Tab;
  template: TemplateId;
  versions: Version[];
};

export default function Home() {
  const [providers, setProviders] = useState<string[] | null>(null);

  const [fileName, setFileName] = useState("");
  const [jd, setJd] = useState("");
  const [custom, setCustom] = useState("");
  const [company, setCompany] = useState("");
  const [tier, setTier] = useState<Tier>("fast");

  const [phase, setPhase] = useState<Phase>("idle");
  const [templateHtml, setTemplateHtml] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [tailoredHtml, setTailoredHtml] = useState("");
  const [tailoredContent, setTailoredContent] = useState<unknown>(null);
  const [changes, setChanges] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [engine, setEngine] = useState<Engine | null>(null);

  const [tab, setTab] = useState<Tab>("original");
  const [template, setTemplate] = useState<TemplateId>("mirror");
  const [versions, setVersions] = useState<Version[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  // Baseline for the diff: -1 = the original (analyzed) résumé; ≥0 = a saved version index.
  const [compareBaseIdx, setCompareBaseIdx] = useState(-1);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string>("");
  const [canRetry, setCanRetry] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const tierRef = useRef<Tier>(tier);
  tierRef.current = tier;
  // Closure that re-runs the most recent failed action (analyze or tailor).
  const retryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  // Restore saved session on first mount (refresh-safe).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Persisted>;
        if (s.fileName) setFileName(s.fileName);
        if (s.jd) setJd(s.jd);
        if (s.custom) setCustom(s.custom);
        if (s.company) setCompany(s.company);
        if (s.tier) setTier(s.tier);
        if (s.templateHtml) setTemplateHtml(s.templateHtml);
        if (s.content) setContent(s.content);
        if (s.tailoredHtml) setTailoredHtml(s.tailoredHtml);
        if (s.tailoredContent) setTailoredContent(s.tailoredContent);
        if (s.changes) setChanges(s.changes);
        if (s.keywords) setKeywords(s.keywords);
        if (s.engine) setEngine(s.engine);
        if (s.tab) setTab(s.tab);
        if (s.template) setTemplate(s.template);
        if (Array.isArray(s.versions)) setVersions(s.versions);
        // Never restore a transient busy phase — derive a resting one from data.
        setPhase(s.tailoredHtml ? "done" : s.templateHtml ? "analyzed" : "idle");
      }
    } catch {
      // ignore corrupt/oversized storage
    }
    setHydrated(true);
  }, []);

  // Persist session whenever meaningful state changes (skip transient phases).
  useEffect(() => {
    if (!hydrated || phase === "analyzing" || phase === "tailoring") return;
    try {
      const data: Persisted = {
        fileName,
        jd,
        custom,
        company,
        tier,
        templateHtml,
        content,
        tailoredHtml,
        tailoredContent,
        changes,
        keywords,
        engine,
        tab,
        template,
        versions: versions.slice(-5),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota errors
    }
  }, [
    hydrated,
    phase,
    fileName,
    jd,
    custom,
    company,
    tier,
    templateHtml,
    content,
    tailoredHtml,
    tailoredContent,
    changes,
    keywords,
    engine,
    tab,
    template,
    versions,
  ]);

  const analyze = useCallback(async (base64: string) => {
    setPhase("analyzing");
    setError("");
    setCanRetry(false);
    retryRef.current = () => void analyze(base64);
    setTailoredHtml("");
    setTailoredContent(null);
    setChanges([]);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, tier: tierRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setTemplateHtml(data.templateHtml);
      setContent(data.content);
      setEngine(data.engine);
      setTab("original");
      setPhase("analyzed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setCanRetry(true);
      setPhase("idle");
    }
  }, []);

  const readFile = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      setError("");
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        const base64 = result.split(",")[1] ?? "";
        setFileName(file.name);
        void analyze(base64);
      };
      reader.readAsDataURL(file);
    },
    [analyze]
  );

  async function tailor() {
    if (!templateHtml || !jd.trim()) return;
    setPhase("tailoring");
    setError("");
    setCanRetry(false);
    retryRef.current = () => void tailor();
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          templateHtml,
          jobDescription: jd,
          customization: custom,
          tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tailoring failed.");
      setTailoredHtml(data.tailoredHtml);
      setTailoredContent(data.tailoredContent);
      setChanges(data.changes ?? []);
      setKeywords(data.keywords ?? []);
      setEngine(data.engine);
      // Save this run as a version (keep the last 5) so it can be diffed/revisited.
      setVersions((prev) =>
        [
          ...prev,
          {
            label: `v${prev.length + 1}`,
            tailoredContent: data.tailoredContent,
            tailoredHtml: data.tailoredHtml,
            changes: data.changes ?? [],
            customization: custom,
            keywords: data.keywords ?? [],
          },
        ].slice(-5)
      );
      setTab("tailored");
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tailoring failed.");
      setCanRetry(true);
      setPhase("analyzed");
    }
  }

  async function doExport(fmt: "pdf" | "docx" | "txt" | "md") {
    setExporting(fmt);
    setError("");
    try {
      const html = showHtml;
      const exportContent = activeContent ?? content;
      // Name the file "<Candidate Name> - <Company> - <YYYY-MM-DD>".
      const resumeName =
        (activeContent?.name ?? "").trim() || fileName.replace(/\.pdf$/i, "") || "resume";
      const now = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const datestamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
      const base = [resumeName, company.trim(), datestamp].filter(Boolean).join(" - ");
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: fmt,
          html,
          content: exportContent,
          filename: base,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting("");
    }
  }

  const busy = phase === "analyzing" || phase === "tailoring";
  const noProvider = providers !== null && providers.length === 0;
  const activeContent = (tab === "tailored" ? tailoredContent : content) as ResumeContent | null;
  const mirrorHtml = tab === "tailored" && tailoredHtml ? tailoredHtml : templateHtml;
  const showHtml =
    template === "mirror"
      ? mirrorHtml
      : activeContent
        ? (getTemplate(template)?.render(activeContent) ?? mirrorHtml)
        : mirrorHtml;

  // Deterministic diff of the current tailored content vs the chosen baseline.
  const diffBase =
    compareBaseIdx >= 0 && versions[compareBaseIdx]
      ? versions[compareBaseIdx].tailoredContent
      : content;
  const diff: ResumeDiff | null =
    showDiff && tailoredContent && diffBase
      ? diffResume(diffBase as ResumeContent, tailoredContent as ResumeContent)
      : null;

  // Load a saved version into the current view (preview + export reflect it).
  function loadVersion(v: Version) {
    setTailoredHtml(v.tailoredHtml);
    setTailoredContent(v.tailoredContent);
    setChanges(v.changes);
    setKeywords(v.keywords ?? []);
    setTab("tailored");
  }

  // Append a missing JD keyword to the customization box (the gap-fill path).
  function addToCustomization(term: string) {
    setCustom((c) => (c.trim() ? `${c}\n${term}` : term));
  }

  // Deterministic ATS keyword coverage of the current tailored content vs the JD.
  const cov =
    tailoredContent && keywords.length
      ? coverage(keywords, resumeText(tailoredContent as ResumeContent))
      : null;

  // Wipe the locally-stored session (résumé content, tailored versions, JD, etc.).
  function clearData() {
    if (!window.confirm("Clear your résumé, job description, and all tailored results from this browser?")) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setFileName("");
    setJd("");
    setCustom("");
    setCompany("");
    setTemplateHtml("");
    setContent(null);
    setTailoredHtml("");
    setTailoredContent(null);
    setChanges([]);
    setKeywords([]);
    setEngine(null);
    setTab("original");
    setTemplate("mirror");
    setVersions([]);
    setShowDiff(false);
    setCompareBaseIdx(-1);
    setPhase("idle");
    setError("");
    setCanRetry(false);
  }

  return (
    <>
      <header className="topbar">
        <div className="shell flex items-center justify-between" style={{ height: 64 }}>
          <span className="wordmark">
            <span className="nib" />
            Tailorwright
          </span>
          <div className="flex items-center gap-2">
            {engine && (
              <span className="chip">
                <span className="dot" />
                {engine.provider} · {engine.model}
              </span>
            )}
            <span
              className="chip"
              title="Your résumé is sent to the AI provider you configured to be processed. It is not stored on any server — only in this browser, which you can clear anytime."
            >
              <span className="dot" />
              No server storage
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearData}>
              Clear data
            </button>
          </div>
        </div>
      </header>

      <main className="shell" style={{ paddingTop: 40, paddingBottom: 80, flex: 1 }}>
        <section className="rise" style={{ maxWidth: 720, marginBottom: 36 }}>
          <p className="micro" style={{ marginBottom: 14 }}>
            Résumé · tailored to the role · in your own layout
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 46,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 540,
            }}
          >
            Rewrite your résumé for the job —{" "}
            <span style={{ color: "var(--accent)", fontStyle: "italic" }}>
              keeping the design you already have.
            </span>
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 17,
              color: "var(--ink-soft)",
              lineHeight: 1.55,
            }}
          >
            Upload your résumé, paste the job description, and get a tailored version that
            mirrors your original layout — every claim grounded in what you actually wrote.
          </p>
        </section>

        {noProvider && (
          <div
            className="panel rise"
            style={{ padding: "16px 18px", marginBottom: 24, borderColor: "var(--accent)" }}
          >
            <strong className="font-display">No AI engine configured.</strong>{" "}
            <span style={{ color: "var(--ink-soft)" }}>
              Add{" "}
              <code className="font-mono" style={{ color: "var(--accent-deep)" }}>
                ANTHROPIC_API_KEY
              </code>{" "}
              or{" "}
              <code className="font-mono" style={{ color: "var(--accent-deep)" }}>
                GEMINI_API_KEY
              </code>{" "}
              to <code className="font-mono">.env.local</code> and restart the server.
            </span>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(340px, 430px) 1fr",
            gap: 28,
            alignItems: "start",
          }}
        >
          {/* ---------- Controls ---------- */}
          <div className="flex flex-col gap-5">
            <div className="panel" style={{ padding: 22 }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span className="step-no">1</span>
                <span className="step-title">Upload your résumé</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              />
              <div
                className={`drop ${drag ? "drag" : ""} ${fileName ? "has-file" : ""}`}
                style={{ padding: "26px 20px", textAlign: "center" }}
                onClick={() => !fileName && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) readFile(f);
                }}
              >
                {fileName ? (
                  <div>
                    <div className="font-mono" style={{ fontSize: 13, color: "var(--verify)" }}>
                      ✓ {phase === "analyzing" ? "reading" : "loaded"}
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>{fileName}</div>
                    <button
                      className="btn btn-ghost"
                      style={{ marginTop: 12 }}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        inputRef.current?.click();
                      }}
                    >
                      Replace file
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      Drop a PDF here, or click to browse
                    </div>
                    <div className="micro" style={{ marginTop: 8, letterSpacing: "0.1em" }}>
                      PDF only · stays in this session
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel" style={{ padding: 22 }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span className="step-no">2</span>
                <span className="step-title">Paste the job description</span>
              </div>
              <textarea
                className="jd"
                placeholder="Paste the full job posting — responsibilities, requirements, the lot. The more detail, the sharper the tailoring."
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />

              <div className="flex items-center gap-2" style={{ margin: "16px 0 8px" }}>
                <span className="step-title" style={{ fontSize: 14 }}>
                  Target company
                </span>
                <span className="micro">optional · used in the file name</span>
              </div>
              <input
                className="jd"
                style={{ minHeight: 0, padding: "10px 12px" }}
                placeholder="e.g. Sprinto"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />

              <div className="flex items-center gap-2" style={{ margin: "16px 0 8px" }}>
                <span className="step-title" style={{ fontSize: 14 }}>
                  Customization
                </span>
                <span className="micro">optional</span>
              </div>
              <textarea
                className="jd"
                style={{ minHeight: 96 }}
                placeholder="Highlights to make sure are included — e.g. led a team of 6, AWS certified, shipped X to 10k users. One per line. These are treated as true facts about you and woven in."
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>

            <div className="panel" style={{ padding: 22 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-3">
                  <span className="step-no">3</span>
                  <span className="step-title">Tailor</span>
                </div>
                <div className="seg" title="Best is slower and sharper">
                  <button className={tier === "fast" ? "on" : ""} onClick={() => setTier("fast")}>
                    Fast
                  </button>
                  <button className={tier === "best" ? "on" : ""} onClick={() => setTier("best")}>
                    Best
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                disabled={busy || noProvider || phase === "idle" || !jd.trim()}
                onClick={tailor}
              >
                {phase === "tailoring" ? (
                  <>
                    <span className="spin" /> Tailoring your résumé…
                  </>
                ) : phase === "analyzing" ? (
                  <>
                    <span className="spin" /> Reading your résumé…
                  </>
                ) : phase === "done" ? (
                  "Re-tailor"
                ) : (
                  "Tailor my résumé →"
                )}
              </button>

              {phase === "idle" && !busy && (
                <p className="micro" style={{ marginTop: 12, textAlign: "center" }}>
                  Upload a résumé to begin
                </p>
              )}
              {phase === "analyzed" && !jd.trim() && (
                <p className="micro" style={{ marginTop: 12, textAlign: "center" }}>
                  Paste a job description to enable tailoring
                </p>
              )}
              {busy && <div className="bar" style={{ marginTop: 16 }} />}
              {error && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 13, color: "var(--accent-deep)" }}>{error}</p>
                  {canRetry && (
                    <button
                      className="btn btn-ghost"
                      style={{ marginTop: 10 }}
                      disabled={busy}
                      onClick={() => {
                        setError("");
                        setCanRetry(false);
                        retryRef.current?.();
                      }}
                    >
                      ↻ Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {cov && (
              <div className="panel rise" style={{ padding: 22 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                  <span className="step-title">ATS keyword match</span>
                  <span className="chip">
                    <span className="dot" />
                    {cov.score}% · {cov.covered.length}/{cov.total}
                  </span>
                </div>
                {cov.missing.length > 0 ? (
                  <>
                    <p className="micro" style={{ margin: "0 0 10px" }}>
                      Missing from your résumé. Click any that are <strong>genuinely true</strong> to add
                      them below, then re-tailor:
                    </p>
                    <div className="flex" style={{ flexWrap: "wrap", gap: 6 }}>
                      {cov.missing.map((m, i) => (
                        <button
                          key={i}
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: "3px 9px" }}
                          onClick={() => addToCustomization(m)}
                          title="Add to Customization"
                        >
                          + {m}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="micro">Every JD keyword is represented in your résumé. 🎯</p>
                )}
              </div>
            )}

            {versions.length > 0 && (
              <div className="panel rise" style={{ padding: 22 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <span className="step-title">What changed</span>
                  {versions.length > 1 && (
                    <select
                      className="seg"
                      style={{ fontSize: 12, padding: "4px 6px" }}
                      onChange={(e) => {
                        const v = versions[Number(e.target.value)];
                        if (v) loadVersion(v);
                      }}
                      defaultValue={versions.length - 1}
                      title="View a saved version"
                    >
                      {versions.map((v, i) => (
                        <option key={i} value={i}>
                          {v.label}
                          {i === versions.length - 1 ? " (latest)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {changes.length > 0 && (
                  <>
                    <p className="micro" style={{ margin: "0 0 8px", letterSpacing: "0.1em" }}>
                      Review before you send
                    </p>
                    <div>
                      {changes.map((c, i) => (
                        <div key={i} className="change-row">
                          <span className="tick">✓</span>
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div className="flex items-center justify-between" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-ghost" onClick={() => setShowDiff((v) => !v)}>
                      {showDiff ? "Hide diff" : "Compare changes"}
                    </button>
                    {showDiff && (
                      <label className="micro" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        vs
                        <select
                          value={compareBaseIdx}
                          onChange={(e) => setCompareBaseIdx(Number(e.target.value))}
                          style={{ fontSize: 12, padding: "3px 6px" }}
                        >
                          <option value={-1}>Original</option>
                          {versions.slice(0, -1).map((v, i) => (
                            <option key={i} value={i}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {showDiff && diff && (
                    <div style={{ marginTop: 12 }}>
                      <DiffView diff={diff} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---------- Preview ---------- */}
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: 12, flexWrap: "wrap" }}
            >
              <span className="micro">Layout</span>
              <div className="seg">
                <button
                  className={template === "mirror" ? "on" : ""}
                  disabled={!templateHtml}
                  onClick={() => setTemplate("mirror")}
                >
                  Your layout
                </button>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    className={template === t.id ? "on" : ""}
                    disabled={!templateHtml}
                    onClick={() => setTemplate(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="preview-tabs">
              <button
                className={tab === "original" ? "on" : ""}
                disabled={!templateHtml}
                onClick={() => setTab("original")}
              >
                Original
              </button>
              <button
                className={tab === "tailored" ? "on" : ""}
                disabled={!tailoredHtml}
                onClick={() => setTab("tailored")}
              >
                Tailored
              </button>
            </div>

            <div className="previewport" style={{ padding: 22, minHeight: 520 }}>
              {showHtml ? (
                <div className="paper-shadow" key={tab} style={{ borderRadius: 2 }}>
                  <PreviewFrame html={showHtml} />
                </div>
              ) : (
                <div
                  style={{
                    height: 480,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  {busy ? (
                    <>
                      <span className="spin" style={{ color: "var(--accent)" }} />
                      <p style={{ marginTop: 16 }} className="font-display">
                        {phase === "analyzing"
                          ? "Reconstructing your résumé's layout…"
                          : "Tailoring the content…"}
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        className="font-display"
                        style={{ fontSize: 28, color: "var(--line-strong)" }}
                      >
                        Your résumé will appear here
                      </div>
                      <p className="micro" style={{ marginTop: 10 }}>
                        a faithful re-creation of your layout
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-between"
              style={{ marginTop: 18, flexWrap: "wrap", gap: 12 }}
            >
              <span className="micro">Download tailored résumé</span>
              <div className="flex items-center gap-2">
                {EXPORTS.map(({ fmt, label }) => (
                  <button
                    key={fmt}
                    className="btn btn-ghost"
                    disabled={(!tailoredHtml && !templateHtml) || !!exporting}
                    onClick={() => doExport(fmt)}
                  >
                    {exporting === fmt ? <span className="spin" /> : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="shell" style={{ paddingBottom: 30 }}>
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 18,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span className="micro">Tailorwright</span>
          <span className="micro">
            Grounded in your real experience · no fabrication · sent to your AI provider, not stored on a server
          </span>
        </div>
      </footer>
    </>
  );
}
