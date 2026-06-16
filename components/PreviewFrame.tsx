"use client";

import { useEffect, useRef, useState } from "react";

const PAGE_W = 816; // 8.5in at 96dpi

// Screen-only styling so the preview shows the same 1.25cm page margins as the
// exported PDF (the PDF's per-page margins come from "@page" and don't render
// on screen). Injected into the document head; print is untouched.
const SCREEN_MARGIN_CSS = `
<style>
@media screen {
  html, body { background: #e9e7e2; margin: 0; }
  .page {
    background: #fff;
    box-sizing: border-box;
    padding: 1.25cm !important;
    margin: 0 auto !important;
    width: 8.5in !important;
  }
}
</style>`;

function withScreenMargins(html: string): string {
  if (html.includes("</head>")) return html.replace("</head>", `${SCREEN_MARGIN_CSS}</head>`);
  if (html.includes("<body")) return html.replace("<body", `${SCREEN_MARGIN_CSS}<body`);
  return SCREEN_MARGIN_CSS + html;
}

export function PreviewFrame({ html }: { html: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [docHeight, setDocHeight] = useState(1056);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      setScale(Math.min(1, w / PAGE_W));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const h = Math.max(
      doc.body?.scrollHeight ?? 0,
      doc.documentElement?.scrollHeight ?? 0,
      1056
    );
    setDocHeight(h);
  };

  const onLoad = () => {
    measure();
    // Re-measure after fonts settle.
    setTimeout(measure, 250);
  };

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <div style={{ height: docHeight * scale, position: "relative" }}>
        <iframe
          ref={iframeRef}
          title="Résumé preview"
          srcDoc={withScreenMargins(html)}
          onLoad={onLoad}
          sandbox="allow-same-origin"
          style={{
            width: PAGE_W,
            height: docHeight,
            border: "none",
            background: "white",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
