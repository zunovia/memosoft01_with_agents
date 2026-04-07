"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

type NoteListItem = {
  id: string;
  title: string;
  updated_at: string;
  tags?: string[];
  snippet?: string;
  pinned?: boolean;
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [q, setQ] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templateMenu, setTemplateMenu] = useState(false);
  const [sort, setSort] = useState<"updated" | "title">("updated");
  const router = useRouter();
  const pathname = usePathname();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) {
      params.set("q", query);
      params.set("snippet", "1");
    }
    const res = await fetch(`/api/notes${params.toString() ? `?${params}` : ""}`);
    if (res.ok) {
      const json = await res.json();
      setNotes(json.notes);
    }
    setLoading(false);
  }, []);

  function highlight(text: string, query: string) {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 text-black dark:text-white px-0.5 rounded">{p}</mark>
        : <span key={i}>{p}</span>
    );
  }

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  // Realtime: refresh list when any note changes (other devices)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        () => {
          load(q);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, q]);

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
    const base = tagFilter ? notes.filter((n) => (n.tags || []).includes(tagFilter)) : notes;
    if (sort === "title") {
      return [...base].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return base;
  }, [notes, tagFilter, sort]);

  async function createNote() {
    const res = await fetch("/api/notes", { method: "POST" });
    if (res.ok) {
      const { note } = await res.json();
      router.push(`/notes/${note.id}`);
    }
  }

  const TEMPLATES: { name: string; title: string; content: string }[] = [
    {
      name: "📋 ミーティング",
      title: `Meeting ${new Date().toISOString().slice(0, 10)}`,
      content: `# ミーティング\n\n**日付:** ${new Date().toLocaleDateString()}\n**参加者:** \n\n## アジェンダ\n- \n\n## 議論\n- \n\n## 決定事項\n- \n\n## TODO\n- [ ] \n\n#meeting`,
    },
    {
      name: "🚀 プロジェクト",
      title: "Project: ",
      content: `# プロジェクト名\n\n## 目的\n\n\n## ゴール\n- \n\n## マイルストーン\n- [ ] \n\n## リスク\n- \n\n## 関連\n- [[]]\n\n#project`,
    },
    {
      name: "💡 ブレスト",
      title: "Brainstorm: ",
      content: `# ブレインストーミング\n\n**テーマ:** \n\n## アイデア\n- \n- \n- \n\n## 評価\n\n## 次のアクション\n- [ ] \n\n#brainstorm`,
    },
    {
      name: "📚 読書メモ",
      title: "Book: ",
      content: `# 書名\n\n**著者:** \n**読了日:** ${new Date().toLocaleDateString()}\n\n## 要約\n\n\n## 印象的な引用\n> \n\n## 学び\n- \n\n## 関連\n- [[]]\n\n#book`,
    },
  ];

  async function createFromTemplate(t: typeof TEMPLATES[number]) {
    setTemplateMenu(false);
    const res = await fetch("/api/notes", { method: "POST" });
    if (!res.ok) return;
    const { note } = await res.json();
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: t.title, content: t.content }),
    });
    router.push(`/notes/${note.id}`);
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
          <Link href="/chat" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Chat</Link>
          <Link href="/tasks" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Tasks</Link>
          <Link href="/activity" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">📊</Link>
          <Link href="/review" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">📅</Link>
          <Link href="/orphans" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">🪦</Link>
          <Link href="/words" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">☁️</Link>
          <button
            onClick={async () => {
              const r = await fetch("/api/notes/random");
              if (r.ok) { const j = await r.json(); if (j.id) router.push(`/notes/${j.id}`); }
            }}
            className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
            title="ランダムノート"
          >🎲</button>
          <Link href="/notes/trash" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">🗑</Link>
          <Link href="/settings" className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline">Settings</Link>
          <span className="text-[10px] text-zinc-500 border border-zinc-300 dark:border-zinc-700 rounded px-1" title="クイックスイッチャー">⌘K</span>
        </div>
        <div className="px-3 pt-2 flex items-center gap-2">
          <ThemeToggle />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "updated" | "title")}
            className="text-[10px] px-1 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent ml-auto"
          >
            <option value="updated">更新順</option>
            <option value="title">タイトル順</option>
          </select>
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
          <div className="relative">
            <button
              onClick={() => setTemplateMenu((v) => !v)}
              className="px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="テンプレートから作成"
            >📄</button>
            {templateMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-lg">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => createFromTemplate(t)}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >{t.name}</button>
                ))}
              </div>
            )}
          </div>
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
                    <div className="truncate font-medium">{n.pinned && "📌 "}{highlight(n.title || "Untitled", q)}</div>
                    <div className="text-[10px] text-zinc-500">{new Date(n.updated_at).toLocaleString()}</div>
                    {n.snippet && q && (
                      <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">{highlight(n.snippet, q)}</div>
                    )}
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
      {/* Mobile FAB */}
      <button
        onClick={createNote}
        className="md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-blue-600 text-white text-2xl shadow-2xl hover:bg-blue-700 active:scale-95 transition"
        aria-label="新規ノート"
      >+</button>
    </div>
  );
}
