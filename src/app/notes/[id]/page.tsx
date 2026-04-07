"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function handleDelete() {
    if (!confirm("このノートを削除しますか?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
    router.refresh();
  }

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
        <span className="text-xs text-zinc-500">{saving ? "保存中..." : "保存済み"}</span>
        <button
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >削除</button>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          <CodeMirror
            value={content}
            height="100%"
            theme="dark"
            extensions={[markdown()]}
            onChange={(v) => {
              setContent(v);
              scheduleSave({ content: v });
            }}
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
        </div>
        <div className="overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
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
