"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Orphan = { id: string; title: string; updated_at: string };

export default function OrphansPage() {
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orphans")
      .then((r) => r.json())
      .then((j) => setOrphans(j.orphans || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">🪦 孤立ノート</h1>
        <span className="text-xs text-zinc-500 ml-2">どこからもリンクされていないノート</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        {loading && <div className="text-xs text-zinc-500">Loading...</div>}
        {!loading && orphans.length === 0 && <div className="text-xs text-zinc-500">孤立したノートはありません 🎉</div>}
        <ul className="space-y-1">
          {orphans.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} className="block px-3 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">
                <div className="font-medium">{n.title || "(無題)"}</div>
                <div className="text-[10px] text-zinc-500">{new Date(n.updated_at).toLocaleString()}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
