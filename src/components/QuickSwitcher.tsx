"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Note = { id: string; title: string; updated_at: string };

export default function QuickSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/notes")
      .then((r) => r.json())
      .then((j) => setNotes(j.notes || []));
    setQ("");
    setIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notes.slice(0, 30);
    return notes
      .filter((n) => (n.title || "").toLowerCase().includes(s))
      .slice(0, 30);
  }, [q, notes]);

  function go(n: Note) {
    setOpen(false);
    router.push(`/notes/${n.id}`);
  }

  async function createNew() {
    const res = await fetch("/api/notes", { method: "POST" });
    if (res.ok) {
      const { note } = await res.json();
      if (q.trim()) {
        await fetch(`/api/notes/${note.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: q.trim() }),
        });
      }
      setOpen(false);
      router.push(`/notes/${note.id}`);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[15vh] p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, filtered.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (idx < filtered.length) go(filtered[idx]);
              else createNew();
            }
          }}
          placeholder="ノートを検索... (Enterで新規作成)"
          className="w-full px-4 py-3 text-sm bg-transparent outline-none border-b border-zinc-200 dark:border-zinc-800"
        />
        <ul className="max-h-[50vh] overflow-y-auto">
          {filtered.map((n, i) => (
            <li
              key={n.id}
              onClick={() => go(n)}
              onMouseEnter={() => setIdx(i)}
              className={`px-4 py-2 text-sm cursor-pointer ${i === idx ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              <div className="font-medium truncate">{n.title || "Untitled"}</div>
              <div className={`text-[10px] ${i === idx ? "text-blue-100" : "text-zinc-500"}`}>
                {new Date(n.updated_at).toLocaleString()}
              </div>
            </li>
          ))}
          {q.trim() && (
            <li
              onClick={createNew}
              onMouseEnter={() => setIdx(filtered.length)}
              className={`px-4 py-2 text-sm cursor-pointer border-t border-zinc-200 dark:border-zinc-800 ${idx === filtered.length ? "bg-green-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              + 新規作成: 「{q}」
            </li>
          )}
        </ul>
        <div className="px-4 py-2 text-[10px] text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <span>↑↓ 移動</span>
          <span>Enter 開く</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  );
}
