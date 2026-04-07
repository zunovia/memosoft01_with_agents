"use client";

import { useEffect, useState, useCallback } from "react";

type TrashNote = {
  id: string;
  title: string;
  updated_at: string;
  deleted_at: string | null;
};

export default function TrashPage() {
  const [notes, setNotes] = useState<TrashNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/notes?trash=1");
    const j = await r.json();
    setNotes(j.notes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(id: string) {
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    load();
  }

  async function purge(id: string) {
    if (!confirm("完全に削除しますか? この操作は取り消せません。")) return;
    await fetch(`/api/notes/${id}?hard=1`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-xl font-bold mb-4">🗑 ゴミ箱</h1>
      {loading && <div className="text-sm text-zinc-500">Loading...</div>}
      {!loading && notes.length === 0 && (
        <div className="text-sm text-zinc-500">空です</div>
      )}
      <ul className="space-y-2">
        {notes.map((n) => (
          <li
            key={n.id}
            className="border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center gap-3"
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{n.title || "Untitled"}</div>
              <div className="text-[10px] text-zinc-500">
                削除日時: {n.deleted_at ? new Date(n.deleted_at).toLocaleString() : "-"}
              </div>
            </div>
            <button
              onClick={() => restore(n.id)}
              className="px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >復元</button>
            <button
              onClick={() => purge(n.id)}
              className="px-2 py-1 text-xs text-red-600 border border-red-300 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950"
            >完全削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
