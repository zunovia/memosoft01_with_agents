"use client";

import { useEffect, useState } from "react";
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

type HistoryItem = {
  id: string;
  source_note_ids: string[];
  types: string[];
  result: { markdown?: string } | null;
  created_at: string;
};

export default function AnalysisModal({ noteIds, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"run" | "history">("run");
  const [types, setTypes] = useState<Set<string>>(new Set(["ideas", "themes", "questions"]));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (noteIds.length === 0) return;
    fetch("/api/notes")
      .then((r) => r.json())
      .then((j) => {
        const ids = new Set(noteIds);
        const titles = (j.notes || [])
          .filter((n: { id: string }) => ids.has(n.id))
          .map((n: { title: string }) => n.title || "Untitled");
        setSelectedTitles(titles);
      });
  }, [noteIds]);

  useEffect(() => {
    if (tab !== "history") return;
    setHistoryLoading(true);
    fetch("/api/analyze/history")
      .then((r) => r.json())
      .then((j) => setHistory(j.analyses || []))
      .finally(() => setHistoryLoading(false));
  }, [tab]);

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

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <h2 className="text-lg font-semibold">AI解析</h2>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => setTab("run")}
              className={`px-2 py-1 text-xs rounded ${tab === "run" ? "bg-blue-600 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
            >実行</button>
            <button
              onClick={() => setTab("history")}
              className={`px-2 py-1 text-xs rounded ${tab === "history" ? "bg-blue-600 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
            >履歴</button>
          </div>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-white">✕</button>
        </div>

        {tab === "run" ? (
          <>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              {selectedTitles.length > 0 && (
                <div className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold">対象 ({selectedTitles.length}):</span>{" "}
                  {selectedTitles.slice(0, 6).map((t, i) => (
                    <span key={i} className="inline-block px-1.5 py-0.5 mr-1 mb-1 rounded bg-zinc-100 dark:bg-zinc-800">
                      {t}
                    </span>
                  ))}
                  {selectedTitles.length > 6 && <span>+{selectedTitles.length - 6}</span>}
                </div>
              )}
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
                disabled={running || types.size === 0 || noteIds.length === 0}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >{running ? "解析中..." : "解析開始"}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {result ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              ) : (
                !running && <div className="text-zinc-500 text-sm not-prose">解析タイプを選んで「解析開始」を押してください。</div>
              )}
            </div>
            {result && !running && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  onClick={copyResult}
                  className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded text-sm"
                >{copied ? "コピー済" : "コピー"}</button>
                <button
                  onClick={saveAsNote}
                  disabled={saving}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50"
                >{saving ? "保存中..." : "新規ノートとして保存"}</button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {historyLoading && <div className="text-sm text-zinc-500">読込中...</div>}
            {!historyLoading && history.length === 0 && (
              <div className="text-sm text-zinc-500">履歴がありません</div>
            )}
            <ul className="space-y-3">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="border border-zinc-200 dark:border-zinc-800 rounded p-3"
                >
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                    <span>·</span>
                    <span>{h.source_note_ids.length}ノート</span>
                    <span>·</span>
                    <span>{h.types.join(", ")}</span>
                    <button
                      onClick={() => {
                        setResult(h.result?.markdown || "");
                        setTab("run");
                      }}
                      className="ml-auto px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >開く</button>
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3 whitespace-pre-wrap">
                    {(h.result?.markdown || "").slice(0, 280)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
