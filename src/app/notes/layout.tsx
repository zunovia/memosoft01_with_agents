"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NoteListItem = {
  id: string;
  title: string;
  updated_at: string;
  tags?: string[];
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter((n) => (n.tags || []).includes(tagFilter));
  }, [notes, tagFilter]);

  async function createNote() {
    const res = await fetch("/api/notes", { method: "POST" });
    if (res.ok) {
      const { note } = await res.json();
      router.push(`/notes/${note.id}`);
    }
  }

  async function openDailyNote() {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/notes?q=${encodeURIComponent(today)}`);
    if (res.ok) {
      const j = await res.json();
      const found = (j.notes || []).find((n: NoteListItem) => n.title === today);
      if (found) {
        router.push(`/notes/${found.id}`);
        return;
      }
    }
    const c = await fetch("/api/notes", { method: "POST" });
    if (c.ok) {
      const { note } = await c.json();
      await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: today, content: `# ${today}\n\n` }),
      });
      router.push(`/notes/${note.id}`);
    }
  }

  return (
    <div className="flex flex-1 h-[100dvh] overflow-hidden relative">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="md:hidden fixed top-2 left-2 z-40 p-2 rounded bg-zinc-900 text-white text-xs shadow-lg"
        aria-label="Toggle sidebar"
      >☰</button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-40 w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50 dark:bg-zinc-950 h-full transition-transform`}
      >
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
            onClick={openDailyNote}
            className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="今日のノート"
          >📅</button>
          <button
            onClick={createNote}
            className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            title="New note"
          >+</button>
        </div>
        {allTags.length > 0 && (
          <div className="px-2 pb-2 flex flex-wrap gap-1">
            <button
              onClick={() => setTagFilter("")}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${!tagFilter ? "bg-blue-600 text-white border-blue-600" : "border-zinc-300 dark:border-zinc-700"}`}
            >全</button>
            {allTags.slice(0, 30).map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${tagFilter === t ? "bg-blue-600 text-white border-blue-600" : "border-zinc-300 dark:border-zinc-700"}`}
              >#{t}</button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-3 text-xs text-zinc-500">Loading...</div>}
          {!loading && filtered.length === 0 && <div className="p-3 text-xs text-zinc-500">No notes</div>}
          <ul>
            {filtered.map((n) => {
              const active = pathname === `/notes/${n.id}`;
              return (
                <li key={n.id}>
                  <Link
                    href={`/notes/${n.id}`}
                    className={`block px-3 py-2 text-sm border-b border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 ${active ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
                  >
                    <div className="truncate font-medium">{n.title || "Untitled"}</div>
                    <div className="text-[10px] text-zinc-500">{new Date(n.updated_at).toLocaleString()}</div>
                    {n.tags && n.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {n.tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">#{t}</span>
                        ))}
                      </div>
                    )}
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
