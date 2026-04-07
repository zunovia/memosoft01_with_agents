import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("notes")
    .select("title, content, updated_at")
    .eq("share_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!note) notFound();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-xs text-zinc-500 mb-2">公開ノート · 最終更新 {new Date(note.updated_at).toLocaleString()}</div>
        <h1 className="text-3xl font-bold mb-6">{note.title || "(無題)"}</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
          >{note.content}</ReactMarkdown>
        </div>
        <div className="mt-12 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          Powered by Memo App
        </div>
      </div>
    </div>
  );
}
