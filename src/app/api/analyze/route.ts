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

  const body = await req.json();
  const noteIds: string[] = Array.isArray(body.noteIds) ? body.noteIds : [];
  const types: string[] = Array.isArray(body.types) ? body.types : ["ideas", "themes", "questions"];
  if (noteIds.length === 0) {
    return NextResponse.json({ error: "noteIds required" }, { status: 400 });
  }

  // Fetch encrypted API key
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("encrypted_anthropic_key, iv")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!keyRow) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 400 });
  }
  let apiKey: string;
  try {
    apiKey = decrypt(keyRow.encrypted_anthropic_key, keyRow.iv);
  } catch {
    return NextResponse.json({ error: "failed to decrypt key" }, { status: 500 });
  }

  // Fetch notes
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, content")
    .eq("user_id", user.id)
    .in("id", noteIds);
  if (!notes || notes.length === 0) {
    return NextResponse.json({ error: "no notes found" }, { status: 404 });
  }

  const typeLabels: Record<string, string> = {
    ideas: "💡 新しいアイデア・組み合わせ提案",
    themes: "📋 共通テーマ・要約",
    questions: "🔍 次に探求すべき方向性・問い",
  };
  const requested = types
    .filter((t) => typeLabels[t])
    .map((t) => `- ${typeLabels[t]}`)
    .join("\n");

  const noteSection = notes
    .map((n, i) => `### ノート${i + 1}: ${n.title}\n${n.content}`)
    .join("\n\n---\n\n");

  const system = `あなたはノート分析アシスタントです。提示された複数のメモを読み、要求された出力タイプごとにセクションを分けてMarkdownで返答してください。日本語で出力してください。`;
  const userMsg = `## 選択されたノート\n\n${noteSection}\n\n## 要求する解析\n${requested}\n\nそれぞれセクション (## 見出し) を分けて、具体的かつ示唆に富む内容を出力してください。`;

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  // Stream text deltas as plain text to client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const finalMessage = await stream.finalMessage();
        const fullText = finalMessage.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n");
        // Save to analyses history (best-effort)
        await supabase.from("analyses").insert({
          user_id: user.id,
          source_note_ids: noteIds,
          types,
          result: { markdown: fullText },
        });
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
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
