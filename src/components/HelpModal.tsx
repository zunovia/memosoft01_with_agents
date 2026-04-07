"use client";

import { useEffect, useState } from "react";

const SHORTCUTS = [
  { key: "Ctrl/⌘ + K", desc: "クイックスイッチャー" },
  { key: "Ctrl/⌘ + S", desc: "強制保存" },
  { key: "Ctrl/⌘ + E", desc: "ビュー切替 (分割/編集/表示)" },
  { key: "?", desc: "このヘルプ" },
  { key: "Esc", desc: "モーダルを閉じる" },
];

const SYNTAX = [
  { ex: "[[ノート名]]", desc: "Wikiリンク (なければ自動作成)" },
  { ex: "#tag", desc: "タグ" },
  { ex: "```mermaid", desc: "Mermaid図表" },
  { ex: "$E=mc^2$", desc: "数式 (KaTeX)" },
  { ex: "```js", desc: "コードハイライト" },
];

export default function HelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-md w-full p-5 border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-semibold">ヘルプ</h2>
          <button onClick={() => setOpen(false)} className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <h3 className="text-xs font-semibold text-zinc-500 mb-2">キーボードショートカット</h3>
        <ul className="space-y-1 mb-4 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex">
              <code className="inline-block px-1.5 py-0.5 mr-3 text-xs rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">{s.key}</code>
              <span>{s.desc}</span>
            </li>
          ))}
        </ul>
        <h3 className="text-xs font-semibold text-zinc-500 mb-2">Markdown拡張</h3>
        <ul className="space-y-1 text-sm">
          {SYNTAX.map((s) => (
            <li key={s.ex} className="flex">
              <code className="inline-block px-1.5 py-0.5 mr-3 text-xs rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">{s.ex}</code>
              <span>{s.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
