"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NoteListItem = {
  id: string;
  title: string;
  updated_at: string;
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    const res = await fetch(`/api/notes${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    if (res.ok) {
      const json = await res.json();
      setNotes(json.notes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  async function createNote() {
    const res = await fetch("/api/notes", { method: "POST" });
    if (res.ok) {
      const { note } = await res.json();
      router.push(`/notes/${note.id}`);
    }
  }

  return (
    <div className="flex flex-1 h-[100dvh] overflow-hidden">
      <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Link href="/notes" className="font-semibold text-sm">📝 Notes</Link>
          <Link href="/graph" className="text-xs text-zinc-600 dark:text-zinc-400 ml-auto hover:underline">Graph</Link>
          <Link href="/space" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Space</Link>
          <Link href="/settings" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Settings</Link>
          <span className="text-[10px] text-zinc-500 border border-zinc-300 dark:border-zinc-700 rounded px-1" title="クイックスイッチャー">⌘K</span>
        </div>
        <div className="p-2 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
          <button
            onClick={createNote}
            className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            title="New note"
          >+</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-3 text-xs text-zinc-500">Loading...</div>}
          {!loading && notes.length === 0 && <div className="p-3 text-xs text-zinc-500">No notes</div>}
          <ul>
            {notes.map((n) => {
              const active = pathname === `/notes/${n.id}`;
              return (
                <li key={n.id}>
                  <Link
                    href={`/notes/${n.id}`}
                    className={`block px-3 py-2 text-sm border-b border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 ${active ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
                  >
                    <div className="truncate font-medium">{n.title || "Untitled"}</div>
                    <div className="text-[10px] text-zinc-500">{new Date(n.updated_at).toLocaleString()}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
