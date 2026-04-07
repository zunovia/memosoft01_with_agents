import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: notes } = await supabase
    .from("notes")
    .select("title, content, updated_at, tags")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .gte("updated_at", since.toISOString())
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!notes || notes.length === 0) {
    return NextResponse.json({ error: "今週更新されたノートがありません" }, { status: 400 });
  }

  const noteSection = notes
    .map((n: { title: string; content: string }, i: number) => `### ${i + 1}. ${n.title}\n${n.content.slice(0, 1500)}`)
    .join("\n\n---\n\n");

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: "あなたはユーザーの今週の活動を振り返るアシスタントです。Markdownで構造化された週次レビューを出力してください。",
    messages: [
      {
        role: "user",
        content: `以下は今週(直近7日)に更新されたノートです。これらを読み、次の構造で週次レビューを作成してください。

# 📅 週次レビュー (${new Date().toISOString().slice(0, 10)})

## 📌 ハイライト
今週特に重要だったテーマや決定事項を3-5項目

## 🎯 進捗
完了したこと、進んだことを箇条書きで

## 🤔 学び・気づき
新しく学んだこと、気づきを箇条書きで

## ⚠️ 未解決・課題
継続課題、未着手のことを箇条書きで

## 💡 来週の提案
次に取り組むべきアクション3-5項目

---

## 対象ノート

${noteSection}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[エラー: ${(err as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
