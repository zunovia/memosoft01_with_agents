"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);
  const router = useRouter();

  async function generate() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResult("");
    try {
      const r = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok || !r.body) throw new Error("failed");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveAsNote() {
    if (!result) return;
    const titleMatch = result.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : prompt.slice(0, 40);
    const r = await fetch("/api/notes", { method: "POST" });
    if (!r.ok) return;
    const { note } = await r.json();
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, content: result }),
    });
    router.push(`/notes/${note.id}`);
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">✨ AIノート生成</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-4">
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例: REST APIの設計原則について、初心者向けに体系的にまとめて"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={generate}
              disabled={running || !prompt.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
            >{running ? "生成中..." : "生成"}</button>
            {result && !running && (
              <button onClick={saveAsNote} className="px-4 py-2 text-sm bg-green-600 text-white rounded">ノートに保存</button>
            )}
          </div>
        </div>
        {result && (
          <div className="prose prose-sm dark:prose-invert max-w-none border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
