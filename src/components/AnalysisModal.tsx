"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  noteIds: string[];
  onClose: () => void;
};

const TYPE_OPTIONS: { key: "ideas" | "themes" | "questions"; label: string }[] = [
  { key: "ideas", label: "💡 アイデア提案" },
  { key: "themes", label: "📋 共通テーマ" },
  { key: "questions", label: "🔍 探求すべき問い" },
];

export default function AnalysisModal({ noteIds, onClose }: Props) {
  const router = useRouter();
  const [types, setTypes] = useState<Set<string>>(new Set(["ideas", "themes", "questions"]));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(k: string) {
    const next = new Set(types);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setTypes(next);
  }

  async function run() {
    setRunning(true);
    setResult("");
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteIds, types: [...types] }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || `status ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function saveAsNote() {
    setSaving(true);
    const res = await fetch("/api/analyze/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceNoteIds: noteIds,
        types: [...types],
        resultMarkdown: result,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { note } = await res.json();
      router.push(`/notes/${note.id}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
          <h2 className="text-lg font-semibold">AI解析 ({noteIds.length}ノート)</h2>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap gap-3 mb-3">
            {TYPE_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={types.has(o.key)}
                  onChange={() => toggle(o.key)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <button
            onClick={run}
            disabled={running || types.size === 0}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >{running ? "解析中..." : "解析開始"}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {result ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          ) : (
            !running && <div className="text-zinc-500 text-sm">解析タイプを選んで「解析開始」を押してください。</div>
          )}
        </div>
        {result && !running && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
            <button
              onClick={saveAsNote}
              disabled={saving}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50"
            >{saving ? "保存中..." : "新規ノートとして保存"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
