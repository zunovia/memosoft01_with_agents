"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ReviewPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function generate() {
    setRunning(true);
    setResult("");
    setError("");
    try {
      const r = await fetch("/api/weekly-review", { method: "POST" });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "failed");
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function saveAsNote() {
    if (!result) return;
    const r = await fetch("/api/notes", { method: "POST" });
    if (!r.ok) return;
    const { note } = await r.json();
    const today = new Date().toISOString().slice(0, 10);
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `週次レビュー ${today}`, content: result }),
    });
    router.push(`/notes/${note.id}`);
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">📅 週次レビュー</h1>
        <button
          onClick={generate}
          disabled={running}
          className="ml-auto px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
        >{running ? "生成中..." : "今週のレビューを生成"}</button>
        {result && !running && (
          <button
            onClick={saveAsNote}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded"
          >ノートに保存</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {!result && !running && (
          <div className="text-zinc-500 text-sm">
            直近7日間に更新されたノートを元に、Claudeがあなたの一週間を振り返ります。
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result || (running ? "..." : "")}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
