import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content: string = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return NextResponse.json({ error: "no content" }, { status: 400 });

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
  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 200,
    system: "あなたはノートに簡潔で内容を表すタイトルをつけるアシスタントです。タイトルのみを1行で出力し、引用符や説明は含めないでください。30文字以内。",
    messages: [
      { role: "user", content: `次のノート本文に合うタイトルを1つ提案してください:\n\n${content.slice(0, 3000)}` },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^["「『]|["」』]$/g, "");
  return NextResponse.json({ title: text });
}
