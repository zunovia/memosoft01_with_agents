"use client";

import { use, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import Mermaid from "@/components/Mermaid";

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
  pinned?: boolean;
};

type Backlink = { id: string; title: string };

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [related, setRelated] = useState<{ id: string; title: string; shared: number }[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<{ id: string; title: string }[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((j) => {
        const ns: { id: string; title: string; tags?: string[] }[] = j.notes || [];
        setAllNotes(ns.map((n) => ({ id: n.id, title: n.title })));
        const tagSet = new Set<string>();
        ns.forEach((n) => (n.tags || []).forEach((t) => tagSet.add(t)));
        setAllTags([...tagSet].sort());
      });
  }, []);

  const completionExtension = useCallback(() => {
    const wikiSource = (ctx: CompletionContext): CompletionResult | null => {
      const m = ctx.matchBefore(/\[\[([^\]\n]*)$/);
      if (!m) return null;
      const q = m.text.slice(2).toLowerCase();
      return {
        from: m.from + 2,
        options: allNotes
          .filter((n) => n.title.toLowerCase().includes(q))
          .slice(0, 20)
          .map((n) => ({ label: n.title, apply: n.title + "]]" })),
      };
    };
    const tagSource = (ctx: CompletionContext): CompletionResult | null => {
      const m = ctx.matchBefore(/#([\w\-ぁ-んァ-ヶ一-龠]*)$/);
      if (!m || m.text.length < 1) return null;
      const q = m.text.slice(1).toLowerCase();
      return {
        from: m.from + 1,
        options: allTags
          .filter((t) => t.toLowerCase().includes(q))
          .slice(0, 20)
          .map((t) => ({ label: t, apply: t })),
      };
    };
    return autocompletion({ override: [wikiSource, tagSource] });
  }, [allNotes, allTags]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/notes/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancel) return;
        if (json.note) {
          setNote(json.note);
          setTitle(json.note.title);
          setContent(json.note.content);
          setBacklinks(json.backlinks || []);
          setRelated(json.related || []);
        }
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const save = useCallback(
    async (next: { title?: string; content?: string }) => {
      setSaving(true);
      await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      setSaving(false);
    },
    [id]
  );

  function scheduleSave(next: { title?: string; content?: string }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(next), 800);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        save({ title, content });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setView((v) => (v === "split" ? "preview" : v === "preview" ? "edit" : "split"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, title, content]);

  async function togglePin() {
    if (!note) return;
    const next = !note.pinned;
    setNote({ ...note, pinned: next });
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
  }

  async function handleDelete() {
    if (!confirm("このノートを削除しますか?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
    router.refresh();
  }

  async function runAiAction(action: string) {
    setAiMenuOpen(false);
    setAiRunning(true);
    setAiResult("");
    try {
      const r = await fetch("/api/note-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, title, content }),
      });
      if (!r.ok || !r.body) throw new Error(await r.text());
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAiResult(acc);
      }
    } catch (e) {
      setAiResult(`エラー: ${(e as Error).message}`);
    } finally {
      setAiRunning(false);
    }
  }

  function applyAiResult() {
    if (!aiResult) return;
    const next = aiResult;
    setContent(next);
    scheduleSave({ content: next });
    setAiResult(null);
  }

  function appendAiResult() {
    if (!aiResult) return;
    const next = `${content}\n\n${aiResult}`;
    setContent(next);
    scheduleSave({ content: next });
    setAiResult(null);
  }

  async function suggestTags() {
    setSuggesting(true);
    setSuggestedTags([]);
    try {
      const r = await fetch("/api/suggest-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const j = await r.json();
      setSuggestedTags(j.tags || []);
    } finally {
      setSuggesting(false);
    }
  }

  function applyTag(tag: string) {
    const insert = `\n#${tag}`;
    if (!content.includes(`#${tag}`)) {
      const next = content + insert;
      setContent(next);
      scheduleSave({ content: next });
    }
    setSuggestedTags((prev) => prev.filter((t) => t !== tag));
  }

  function toggleSpeak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = `${title}。${content.replace(/[#*`_~>\[\]]/g, "")}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = /[ぁ-んァ-ヶ一-龠]/.test(text) ? "ja-JP" : "en-US";
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  async function openHistory() {
    setHistoryOpen(true);
    const r = await fetch(`/api/notes/${id}/revisions`);
    if (r.ok) {
      const j = await r.json();
      setRevisions(j.revisions || []);
    }
  }

  function restoreRevision(rev: { title: string; content: string }) {
    if (!confirm("この版で現在の内容を置き換えますか?")) return;
    setTitle(rev.title);
    setContent(rev.content);
    save({ title: rev.title, content: rev.content });
    setHistoryOpen(false);
  }

  async function duplicate() {
    const r = await fetch("/api/notes", { method: "POST" });
    if (!r.ok) return;
    const { note: created } = await r.json();
    await fetch(`/api/notes/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `${title} (copy)`, content }),
    });
    router.push(`/notes/${created.id}`);
  }

  function exportMarkdown() {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "note").replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const chars = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { chars, words };
  }, [content]);

  const renderedContent = useMemo(() => {
    return content.replace(
      /\[\[([^\]\n]+)\]\]/g,
      (_, t) => `[${t}](/notes/wiki/${encodeURIComponent(t.trim())})`
    );
  }, [content]);

  const headings = useMemo(() => {
    const lines = content.split("\n");
    const out: { level: number; text: string; line: number }[] = [];
    let inFence = false;
    lines.forEach((l, i) => {
      if (/^```/.test(l)) inFence = !inFence;
      if (inFence) return;
      const m = /^(#{1,6})\s+(.+)$/.exec(l);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i });
    });
    return out;
  }, [content]);

  if (loading) return <div className="p-6 text-sm text-zinc-500">Loading...</div>;
  if (!note) return <div className="p-6 text-sm text-zinc-500">Not found</div>;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${focusMode ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950" : ""}`}>
      <div className="flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave({ title: e.target.value });
          }}
          className="flex-1 text-lg font-semibold bg-transparent outline-none"
          placeholder="Title"
        />
        <div className="flex border border-zinc-300 dark:border-zinc-700 rounded overflow-hidden text-[10px]">
          {(["edit", "split", "preview"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 ${view === v ? "bg-blue-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >{v === "edit" ? "編集" : v === "split" ? "分割" : "表示"}</button>
          ))}
        </div>
        <span className="text-xs text-zinc-500 hidden sm:inline">{stats.chars}文字 / {stats.words}語</span>
        <span className="text-xs text-zinc-500">{saving ? "保存中..." : "保存済み"}</span>
        <button
          onClick={togglePin}
          className="text-xs hover:underline"
          title="ピン留め"
        >{note.pinned ? "📌" : "📍"}</button>
        <button
          onClick={() => setFocusMode((v) => !v)}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="フォーカスモード (サイドバー非表示)"
        >{focusMode ? "◧" : "◨"}</button>
        <button
          onClick={suggestTags}
          disabled={suggesting}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
          title="AIにタグを提案させる"
        >{suggesting ? "..." : "✨タグ"}</button>
        <div className="relative">
          <button
            onClick={() => setAiMenuOpen((v) => !v)}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            title="AIアシスタント"
          >🤖 AI</button>
          {aiMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded shadow-lg">
              {[
                { k: "summarize", l: "📋 要約" },
                { k: "expand", l: "📈 詳細化" },
                { k: "polish", l: "✏️ 推敲" },
                { k: "outline", l: "🗂 アウトライン" },
                { k: "translate-en", l: "🌐 英訳" },
                { k: "translate-ja", l: "🌐 和訳" },
              ].map((a) => (
                <button
                  key={a.k}
                  onClick={() => runAiAction(a.k)}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >{a.l}</button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleSpeak}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="読み上げ"
        >{speaking ? "⏸" : "🔊"}</button>
        <button
          onClick={openHistory}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="変更履歴"
        >🕒</button>
        <button
          onClick={duplicate}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="複製"
        >⎘</button>
        <button
          onClick={exportMarkdown}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="Markdownエクスポート"
        >.md</button>
        <button
          onClick={() => window.print()}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="印刷 / PDF"
        >🖨</button>
        <button
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >削除</button>
      </div>
      {(aiResult !== null || aiRunning) && (
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-3 bg-purple-50 dark:bg-purple-950/30">
          <div className="flex items-center mb-2 text-xs">
            <span className="font-semibold text-purple-700 dark:text-purple-300">🤖 AI出力{aiRunning ? " (生成中...)" : ""}</span>
            <button
              onClick={appendAiResult}
              disabled={aiRunning || !aiResult}
              className="ml-auto px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded disabled:opacity-50"
            >末尾に追記</button>
            <button
              onClick={applyAiResult}
              disabled={aiRunning || !aiResult}
              className="ml-2 px-2 py-0.5 bg-purple-600 text-white rounded disabled:opacity-50"
            >全置換</button>
            <button
              onClick={() => setAiResult(null)}
              disabled={aiRunning}
              className="ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >✕</button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-60 overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult || "..."}</ReactMarkdown>
          </div>
        </div>
      )}
      {suggestedTags.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs flex-wrap bg-purple-50 dark:bg-purple-950/30">
          <span className="text-purple-700 dark:text-purple-300">提案タグ:</span>
          {suggestedTags.map((t) => (
            <button
              key={t}
              onClick={() => applyTag(t)}
              className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800"
            >+ #{t}</button>
          ))}
          <button
            onClick={() => setSuggestedTags([])}
            className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >✕</button>
        </div>
      )}
      {headings.length > 0 && (
        <details className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs">
          <summary className="cursor-pointer text-zinc-500">アウトライン ({headings.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
                <span className="text-zinc-400 mr-1">{"#".repeat(h.level)}</span>
                <span className="text-zinc-700 dark:text-zinc-300">{h.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className={`flex-1 grid grid-cols-1 ${view === "split" ? "md:grid-cols-2" : ""} overflow-hidden`}>
        {view !== "preview" && (
          <div className="overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
            <CodeMirror
              value={content}
              height="100%"
              theme="dark"
              extensions={[markdown(), completionExtension()]}
              onChange={(v) => {
                setContent(v);
                scheduleSave({ content: v });
              }}
              basicSetup={{ lineNumbers: false, foldGutter: false }}
            />
          </div>
        )}
        {view !== "edit" && (
          <div className="overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{
                code(props) {
                  const { className, children } = props as { className?: string; children?: React.ReactNode };
                  const text = String(children ?? "");
                  if (className === "language-mermaid") {
                    return <Mermaid chart={text.replace(/\n$/, "")} />;
                  }
                  return <code className={className}>{children}</code>;
                },
              }}
            >{renderedContent}</ReactMarkdown>
          </div>
        )}
      </div>
      {related.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 text-xs">
          <div className="font-semibold mb-1">関連ノート</div>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/notes/${r.id}`}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >{r.title} <span className="text-[10px] opacity-60">×{r.shared}</span></Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setHistoryOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
              <h2 className="font-semibold text-sm">🕒 変更履歴</h2>
              <button className="ml-auto text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setHistoryOpen(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {revisions.length === 0 && <div className="p-4 text-xs text-zinc-500">履歴はまだありません</div>}
              {revisions.map((r) => (
                <div key={r.id} className="p-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center mb-1">
                    <span className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</span>
                    <button onClick={() => restoreRevision(r)} className="ml-auto text-xs px-2 py-0.5 bg-blue-600 text-white rounded">復元</button>
                  </div>
                  <div className="text-xs font-medium truncate">{r.title || "(無題)"}</div>
                  <div className="text-[10px] text-zinc-500 line-clamp-2 mt-1">{r.content.slice(0, 200)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {backlinks.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 text-xs">
          <div className="font-semibold mb-1">バックリンク</div>
          <ul className="flex flex-wrap gap-2">
            {backlinks.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/notes/${b.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >← {b.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
