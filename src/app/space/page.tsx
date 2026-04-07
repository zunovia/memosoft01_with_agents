"use client";

import type {} from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

function NoteCard({
  note,
  position,
  onOpen,
}: {
  note: Note;
  position: [number, number, number];
  onOpen: (id: string) => void;
}) {
  return (
    <group position={position}>
      <Html transform distanceFactor={12} occlude={false}>
        <div
          onClick={() => onOpen(note.id)}
          style={{
            width: 220,
            padding: 14,
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            color: "white",
            borderRadius: 10,
            border: "1px solid rgba(96,165,250,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(96,165,250,0.15)",
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            userSelect: "none",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 6, lineHeight: 1.3 }}>
            {note.title || "Untitled"}
          </div>
          <div style={{ fontSize: 9, opacity: 0.5 }}>
            {new Date(note.updated_at).toLocaleDateString()}
          </div>
          {note.tags && note.tags.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 9, color: "#a78bfa" }}>
              {note.tags.slice(0, 4).map((t) => `#${t}`).join(" ")}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function Scene({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
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
        <NoteCard key={n.id} note={n} position={positions[i]} onOpen={onOpen} />
      ))}
      <OrbitControls enableDamping dampingFactor={0.08} rotateSpeed={0.5} />
    </>
  );
}

export default function SpacePage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((j) => {
        setNotes(j.notes || []);
        setLoading(false);
      });
  }, []);

  function openNote(id: string) {
    router.push(`/notes/${id}`);
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3 flex-wrap">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <Link href="/graph" className="text-sm hover:underline">Graph</Link>
        <h1 className="font-semibold">🌌 Space</h1>
        <span className="text-xs text-zinc-500 hidden md:inline">
          ドラッグで回転 / ホイールでズーム / カードクリックで開く
        </span>
        <span className="ml-auto text-sm">{notes.length}件</span>
      </div>
      <div ref={containerRef} className="flex-1 relative bg-black">
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
              <Scene notes={notes} onOpen={openNote} />
            </Canvas>
          </Suspense>
        )}
      </div>
    </div>
  );
}
