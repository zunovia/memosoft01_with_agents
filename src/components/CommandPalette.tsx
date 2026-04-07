"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Command = {
  id: string;
  title: string;
  hint?: string;
  run: () => void | Promise<void>;
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
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
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "new",
        title: "新規ノート",
        hint: "create",
        run: async () => {
          const r = await fetch("/api/notes", { method: "POST" });
          if (r.ok) {
            const { note } = await r.json();
            router.push(`/notes/${note.id}`);
          }
        },
      },
      {
        id: "daily",
        title: "今日のノートを開く",
        hint: "daily",
        run: async () => {
          const today = new Date().toISOString().slice(0, 10);
          const res = await fetch(`/api/notes?q=${encodeURIComponent(today)}`);
          const j = await res.json();
          const found = (j.notes || []).find(
            (n: { title: string }) => n.title === today
          );
          if (found) {
            router.push(`/notes/${found.id}`);
            return;
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
        },
      },
      { id: "notes", title: "ノート一覧", hint: "go", run: () => router.push("/notes") },
      { id: "graph", title: "3Dグラフ", hint: "go", run: () => router.push("/graph") },
      { id: "space", title: "スペースビュー", hint: "go", run: () => router.push("/space") },
      { id: "chat", title: "ノートとチャット", hint: "ai", run: () => router.push("/chat") },
      { id: "settings", title: "設定", hint: "go", run: () => router.push("/settings") },
      {
        id: "export",
        title: "全ノートをJSONエクスポート",
        hint: "backup",
        run: () => {
          window.location.href = "/api/export";
        },
      },
      {
        id: "theme-light",
        title: "テーマ: ライト",
        hint: "theme",
        run: () => {
          localStorage.setItem("theme", "light");
          document.documentElement.classList.remove("dark");
        },
      },
      {
        id: "theme-dark",
        title: "テーマ: ダーク",
        hint: "theme",
        run: () => {
          localStorage.setItem("theme", "dark");
          document.documentElement.classList.add("dark");
        },
      },
      {
        id: "theme-system",
        title: "テーマ: システム",
        hint: "theme",
        run: () => {
          localStorage.setItem("theme", "system");
          const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.classList.toggle("dark", dark);
        },
      },
      {
        id: "logout",
        title: "ログアウト",
        hint: "auth",
        run: async () => {
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut();
          router.push("/login");
          router.refresh();
        },
      },
    ],
    [router]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter(
      (c) => c.title.toLowerCase().includes(s) || (c.hint || "").includes(s)
    );
  }, [q, commands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50 flex items-start justify-center pt-[15vh] p-4"
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
              setIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const cmd = filtered[idx];
              if (cmd) {
                setOpen(false);
                cmd.run();
              }
            }
          }}
          placeholder="コマンドを検索..."
          className="w-full px-4 py-3 text-sm bg-transparent outline-none border-b border-zinc-200 dark:border-zinc-800"
        />
        <ul className="max-h-[50vh] overflow-y-auto">
          {filtered.map((c, i) => (
            <li
              key={c.id}
              onClick={() => {
                setOpen(false);
                c.run();
              }}
              onMouseEnter={() => setIdx(i)}
              className={`px-4 py-2 text-sm cursor-pointer flex items-center ${i === idx ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              <span>{c.title}</span>
              {c.hint && (
                <span className={`ml-auto text-[10px] ${i === idx ? "text-blue-100" : "text-zinc-500"}`}>{c.hint}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 text-[10px] text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <span>↑↓ 移動</span>
          <span>Enter 実行</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  );
}
