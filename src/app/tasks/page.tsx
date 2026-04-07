"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type Task = { noteId: string; noteTitle: string; line: number; text: string; done: boolean };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tasks");
    if (r.ok) setTasks((await r.json()).tasks || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(t: Task) {
    setTasks((prev) => prev.map((x) => (x === t ? { ...x, done: !x.done } : x)));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noteId: t.noteId, line: t.line, done: !t.done }),
    });
  }

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => (filter === "open" ? !t.done : t.done));
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const m = new Map<string, { noteId: string; noteTitle: string; items: Task[] }>();
    filtered.forEach((t) => {
      const key = t.noteId;
      if (!m.has(key)) m.set(key, { noteId: t.noteId, noteTitle: t.noteTitle, items: [] });
      m.get(key)!.items.push(t);
    });
    return [...m.values()];
  }, [filtered]);

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">✅ タスク一覧</h1>
        <div className="ml-auto flex border border-zinc-300 dark:border-zinc-700 rounded overflow-hidden text-xs">
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 ${filter === f ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >{f === "open" ? "未完了" : f === "done" ? "完了" : "全て"}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
        {loading && <div className="text-xs text-zinc-500">Loading...</div>}
        {!loading && grouped.length === 0 && <div className="text-xs text-zinc-500">タスクはありません</div>}
        {grouped.map((g) => (
          <div key={g.noteId} className="mb-4">
            <Link href={`/notes/${g.noteId}`} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">{g.noteTitle || "(無題)"}</Link>
            <ul className="mt-1">
              {g.items.map((t, i) => (
                <li key={i} className="flex items-start gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggle(t)}
                    className="mt-1"
                  />
                  <span className={t.done ? "line-through text-zinc-500" : ""}>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
