"use client";

import type {} from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Canvas = dynamic(() => import("@react-three/fiber").then((m) => m.Canvas), { ssr: false });
const OrbitControls = dynamic(
  () => import("@react-three/drei").then((m) => m.OrbitControls as unknown as React.ComponentType<Record<string, unknown>>),
  { ssr: false }
);
const Stars = dynamic(
  () => import("@react-three/drei").then((m) => m.Stars as unknown as React.ComponentType<Record<string, unknown>>),
  { ssr: false }
);
const Html = dynamic(
  () => import("@react-three/drei").then((m) => m.Html as unknown as React.ComponentType<Record<string, unknown>>),
  { ssr: false }
);

type Note = {
  id: string;
  title: string;
  updated_at: string;
  tags: string[];
  snippet?: string;
};

function fibonacciSphere(n: number, radius: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  if (n === 0) return points;
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points.push([
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ]);
  }
  return points;
}

// stable color from string (tag)
function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function NoteCard({
  note,
  position,
  onOpen,
  highlight,
}: {
  note: Note;
  position: [number, number, number];
  onOpen: (id: string) => void;
  highlight: boolean;
}) {
  const [hover, setHover] = useState(false);
  const scale = hover ? 1.15 : highlight ? 1.05 : 1;
  const accent = note.tags?.[0] ? tagColor(note.tags[0]) : "#60a5fa";
  return (
    <group position={position}>
      <Html transform distanceFactor={12} occlude={false}>
        <div
          onClick={() => onOpen(note.id)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            width: 240,
            padding: 14,
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            color: "white",
            borderRadius: 12,
            border: `1.5px solid ${highlight ? "#fbbf24" : accent}`,
            boxShadow: hover
              ? `0 16px 48px rgba(0,0,0,0.7), 0 0 32px ${accent}`
              : `0 8px 32px rgba(0,0,0,0.6), 0 0 16px ${accent}40`,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            userSelect: "none",
            transform: `scale(${scale})`,
            transformOrigin: "center",
            transition: "transform 180ms ease, box-shadow 180ms ease",
            opacity: highlight || hover ? 1 : 0.92,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 6, lineHeight: 1.3 }}>
            {note.title || "Untitled"}
          </div>
          {note.snippet && (
            <div style={{ fontSize: 10, opacity: 0.75, lineHeight: 1.4, marginBottom: 6, maxHeight: 50, overflow: "hidden" }}>
              {note.snippet}
            </div>
          )}
          <div style={{ fontSize: 9, opacity: 0.5 }}>
            {new Date(note.updated_at).toLocaleDateString()}
          </div>
          {note.tags && note.tags.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 9, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {note.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  style={{
                    color: tagColor(t),
                    border: `1px solid ${tagColor(t)}60`,
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >#{t}</span>
              ))}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function Scene({
  notes,
  onOpen,
  matchedIds,
}: {
  notes: Note[];
  onOpen: (id: string) => void;
  matchedIds: Set<string>;
}) {
  const radius = useMemo(() => Math.max(20, Math.sqrt(notes.length) * 8), [notes.length]);
  const positions = useMemo(() => fibonacciSphere(notes.length, radius), [notes.length, radius]);
  return (
    <>
      <color attach="background" args={["#000010"]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[20, 20, 20]} intensity={1.2} />
      <pointLight position={[-20, -20, -20]} intensity={0.6} color="#a78bfa" />
      <Stars radius={300} depth={80} count={4000} factor={5} fade speed={0.5} />
      {notes.map((n, i) => (
        <NoteCard
          key={n.id}
          note={n}
          position={positions[i]}
          onOpen={onOpen}
          highlight={matchedIds.size === 0 || matchedIds.has(n.id)}
        />
      ))}
      <OrbitControls enableDamping dampingFactor={0.08} rotateSpeed={0.5} />
    </>
  );
}

export default function SpacePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/notes?snippet=1")
      .then((r) => r.json())
      .then((j) => {
        setNotes(j.notes || []);
        setLoading(false);
      });
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [notes]);

  const matchedIds = useMemo(() => {
    if (!search.trim() && !tagFilter) return new Set<string>();
    const q = search.trim().toLowerCase();
    const matches = notes.filter((n) => {
      const tagOk = !tagFilter || (n.tags || []).includes(tagFilter);
      const textOk =
        !q ||
        n.title.toLowerCase().includes(q) ||
        (n.snippet || "").toLowerCase().includes(q);
      return tagOk && textOk;
    });
    return new Set(matches.map((n) => n.id));
  }, [search, tagFilter, notes]);

  function openNote(id: string) {
    router.push(`/notes/${id}`);
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <Link href="/graph" className="text-sm hover:underline">Graph</Link>
        <h1 className="font-semibold">🌌 Space</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="検索..."
          className="ml-2 px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-white w-40"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-2 py-1 text-xs rounded border border-zinc-700 bg-zinc-900 text-white"
        >
          <option value="">全タグ</option>
          {allTags.map((t) => (
            <option key={t} value={t}>#{t}</option>
          ))}
        </select>
        {(search || tagFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setTagFilter("");
            }}
            className="px-2 py-1 text-xs border rounded"
          >×</button>
        )}
        <span className="ml-auto text-sm">
          {matchedIds.size > 0 ? `${matchedIds.size}/` : ""}{notes.length}件
        </span>
      </div>
      <div className="flex-1 relative bg-black">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
            Loading...
          </div>
        ) : notes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
            ノートがありません。<Link href="/notes" className="underline ml-2">作成する</Link>
          </div>
        ) : (
          <Suspense fallback={null}>
            <Canvas camera={{ position: [0, 0, 60], fov: 60 }} dpr={[1, 2]}>
              <Scene notes={notes} onOpen={openNote} matchedIds={matchedIds} />
            </Canvas>
          </Suspense>
        )}
      </div>
    </div>
  );
}
