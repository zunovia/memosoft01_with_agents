"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AnalysisModal from "@/components/AnalysisModal";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphNode = { id: string; title: string };
type GraphLink = { source: string; target: string };

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((j) => {
        setNodes(j.nodes || []);
        setLinks(j.links || []);
      });
  }, []);

  useEffect(() => {
    function onResize() {
      if (containerRef.current) {
        setSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const data = useMemo(() => ({ nodes: [...nodes], links: [...links] }), [nodes, links]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">Graph</h1>
        <span className="text-xs text-zinc-500">クリックでノードを選択 (複数可)</span>
        <span className="ml-auto text-sm">選択中: {selected.size}</span>
        <button
          disabled={selected.size === 0}
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >AI解析</button>
        <button
          onClick={() => setSelected(new Set())}
          className="px-2 py-1 text-xs border rounded"
        >クリア</button>
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <ForceGraph2D
          graphData={data}
          width={size.w}
          height={size.h}
          nodeLabel={(n: object) => (n as GraphNode).title}
          nodeColor={(n: object) => (selected.has((n as GraphNode).id) ? "#3b82f6" : "#9ca3af")}
          nodeRelSize={6}
          linkColor={() => "#6b7280"}
          onNodeClick={(n: object) => toggleSelect((n as GraphNode).id)}
        />
      </div>
      {showModal && (
        <AnalysisModal noteIds={[...selected]} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
