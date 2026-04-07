"use client";

import { useEffect, useRef, useState } from "react";

let counter = 0;

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
        });
        const id = `m${++counter}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (err) return <pre className="text-red-500 text-xs">Mermaid error: {err}</pre>;
  return <div ref={ref} className="my-4 flex justify-center" />;
}
