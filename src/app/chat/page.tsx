"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = { id: string; title: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[] };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: Source[] | undefined;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!sources && buffer.startsWith("__SOURCES__")) {
          const nl = buffer.indexOf("\n\n");
          if (nl > 0) {
            try {
              sources = JSON.parse(buffer.slice("__SOURCES__".length, nl));
            } catch {}
            buffer = buffer.slice(nl + 2);
          }
        }
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: buffer,
            sources,
          };
          return next;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: `エラー: ${(e as Error).message}` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">💬 ノートとチャット</h1>
        <span className="text-xs text-zinc-500 ml-2 hidden md:inline">関連ノートを自動参照して回答します</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-12">
            あなたのノートに質問してみましょう。
            <div className="mt-4 text-xs space-y-1 opacity-70">
              <div>例: 「最近書いたプロジェクトのアイデアをまとめて」</div>
              <div>例: 「#book タグの読書メモから共通する学びは?」</div>
              <div>例: 「先週のミーティングの決定事項を教えて」</div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 ${m.role === "user" ? "bg-blue-600 text-white ml-12" : "bg-zinc-100 dark:bg-zinc-900 mr-12"}`}
          >
            {m.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "..."}</ReactMarkdown>
                {m.sources && m.sources.length > 0 && (
                  <div className="not-prose mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <span className="text-zinc-500">参照: </span>
                    {m.sources.map((s) => (
                      <Link
                        key={s.id}
                        href={`/notes/${s.id}`}
                        className="inline-block mr-2 px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 hover:underline"
                      >{s.title}</Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 max-w-3xl mx-auto w-full flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="質問を入力..."
          className="flex-1 px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >送信</button>
      </div>
    </div>
  );
}
