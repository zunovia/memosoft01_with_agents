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

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updated_at: string;
};

type Backlink = { id: string; title: string };

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allNotes, setAllNotes] = useState<{ id: string; title: string }[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
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

  async function handleDelete() {
    if (!confirm("このノートを削除しますか?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
    router.refresh();
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
    <div className="flex-1 flex flex-col overflow-hidden">
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
          onClick={suggestTags}
          disabled={suggesting}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
          title="AIにタグを提案させる"
        >{suggesting ? "..." : "✨タグ"}</button>
        <button
          onClick={exportMarkdown}
          className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
          title="Markdownエクスポート"
        >.md</button>
        <button
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >削除</button>
      </div>
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderedContent}</ReactMarkdown>
          </div>
        )}
      </div>
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
