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
  const prompt: string = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return NextResponse.json({ error: "no prompt" }, { status: 400 });

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

  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: "あなたはノート生成アシスタントです。与えられたトピックについて、見出し・箇条書き・例を含む構造化されたMarkdownノートを出力してください。タイトル(# 見出し)から始めること。",
    messages: [{ role: "user", content: prompt }],
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
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
