"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecentNote = { id: string; title: string; updated_at: string };
type Task = { noteId: string; noteTitle: string; line: number; text: string; done: boolean };
type Stats = { notes: number; links: number; tags: number; chars: number; analyses: number };

export default function NotesDashboard() {
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/notes").then((r) => r.json()).then((j) => setRecent((j.notes || []).slice(0, 8)));
    fetch("/api/tasks").then((r) => r.json()).then((j) => setTasks((j.tasks || []).filter((t: Task) => !t.done).slice(0, 10)));
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">📊 ダッシュボード</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: "ノート", v: stats.notes, icon: "📝" },
            { label: "リンク", v: stats.links, icon: "🔗" },
            { label: "タグ", v: stats.tags, icon: "🏷" },
            { label: "文字数", v: stats.chars.toLocaleString(), icon: "✏️" },
            { label: "解析", v: stats.analyses, icon: "🤖" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded border border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">{s.icon} {s.label}</div>
              <div className="text-xl font-bold mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">🕒 最近のノート</h2>
          <ul className="space-y-1">
            {recent.length === 0 && <li className="text-xs text-zinc-500">ノートがありません</li>}
            {recent.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="block px-3 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <div className="font-medium truncate">{n.title || "(無題)"}</div>
                  <div className="text-[10px] text-zinc-500">{new Date(n.updated_at).toLocaleString()}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-2 text-zinc-700 dark:text-zinc-300">✅ 未完了タスク</h2>
          <ul className="space-y-1">
            {tasks.length === 0 && <li className="text-xs text-zinc-500">タスクはありません</li>}
            {tasks.map((t, i) => (
              <li key={i} className="px-3 py-2 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-900">
                <div className="truncate">☐ {t.text}</div>
                <Link href={`/notes/${t.noteId}`} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                  → {t.noteTitle}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 text-xs">
        <Link href="/graph" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">🕸 グラフ</Link>
        <Link href="/chat" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">💬 チャット</Link>
        <Link href="/review" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">📅 週次レビュー</Link>
        <Link href="/activity" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">📊 アクティビティ</Link>
        <Link href="/tasks" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">✅ タスク</Link>
        <Link href="/orphans" className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">🪦 孤立</Link>
      </div>
    </div>
  );
}
