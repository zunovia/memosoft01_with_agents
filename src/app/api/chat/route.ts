import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question: string = typeof body.question === "string" ? body.question : "";
  if (!question.trim()) return NextResponse.json({ error: "no question" }, { status: 400 });

  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("encrypted_anthropic_key, iv")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!keyRow) return NextResponse.json({ error: "API key not configured" }, { status: 400 });

  let apiKey: string;
  try {
    apiKey = decrypt(keyRow.encrypted_anthropic_key, keyRow.iv);
  } catch {
    return NextResponse.json({ error: "decrypt failed" }, { status: 500 });
  }

  // Naive retrieval: keyword overlap from question vs title+content
  const tokens = question
    .toLowerCase()
    .split(/[\s、。,.!?？！「」\[\](){}]+/)
    .filter((t) => t.length >= 2);

  const { data: candidates } = await supabase
    .from("notes")
    .select("id, title, content, tags, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  const scored = (candidates ?? []).map((n: { id: string; title: string; content: string; tags: string[] }) => {
    const hay = `${n.title}\n${n.content}\n${(n.tags || []).join(" ")}`.toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 1;
      if (n.title.toLowerCase().includes(t)) score += 2;
    });
    return { ...n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 6);
  // Fallback: most recent if nothing matched
  const context = top.length ? top : scored.slice(0, 4);

  const noteSection = context
    .map((n, i) => `### ノート${i + 1}: ${n.title}\n${n.content.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: `あなたはユーザーのノートを参照しながら質問に答えるアシスタントです。
回答にはノート内容を根拠として引用し、参照したノートのタイトルを「[出典: ノートタイトル]」として末尾に列挙してください。
ノートに情報がない場合はその旨を正直に述べてください。日本語で回答してください。`,
    messages: [
      {
        role: "user",
        content: `## 関連ノート\n\n${noteSection}\n\n## 質問\n${question}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send sources first as JSON line
        controller.enqueue(
          encoder.encode(
            `__SOURCES__${JSON.stringify(context.map((c) => ({ id: c.id, title: c.title })))}\n\n`
          )
        );
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[エラー: ${(err as Error).message}]`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
