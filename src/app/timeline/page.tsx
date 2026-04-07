"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type N = { id: string; title: string; updated_at: string };

export default function TimelinePage() {
  const [notes, setNotes] = useState<N[]>([]);

  useEffect(() => {
    fetch("/api/notes").then((r) => r.json()).then((j) => setNotes(j.notes || []));
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, N[]>();
    notes.forEach((n) => {
      const key = n.updated_at.slice(0, 7); // YYYY-MM
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes]);

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">📜 タイムライン</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {grouped.map(([month, items]) => (
          <section key={month} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-500 sticky top-0 bg-white dark:bg-zinc-950 py-1 border-b border-zinc-200 dark:border-zinc-800">{month}</h2>
            <ul className="mt-2 space-y-1">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={`/notes/${n.id}`} className="block px-3 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[10px] text-zinc-500 w-20 shrink-0">{new Date(n.updated_at).toLocaleString().split(" ")[0]}</span>
                      <span className="font-medium truncate">{n.title || "(無題)"}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
