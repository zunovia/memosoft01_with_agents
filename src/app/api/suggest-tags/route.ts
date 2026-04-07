import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { title, content } = await req.json().catch(() => ({}));
  if (!content && !title) return NextResponse.json({ error: "no content" }, { status: 400 });

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

  // Existing tags for consistency
  const { data: notes } = await supabase
    .from("notes")
    .select("tags")
    .eq("user_id", user.id);
  const existing = new Set<string>();
  (notes ?? []).forEach((n: { tags?: string[] }) =>
    (n.tags || []).forEach((t) => existing.add(t))
  );

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 300,
    system:
      "あなたはノート分類アシスタントです。与えられたノートの内容から、3〜6個の短いタグ(英数字またはひらがな・カタカナ・漢字、空白なし、ハッシュ記号なし)を提案してください。既存タグがあればそれを優先的に再利用してください。出力はJSON配列のみ、例: [\"tag1\",\"tag2\"]",
    messages: [
      {
        role: "user",
        content: `# ${title || "(無題)"}\n\n${(content || "").slice(0, 4000)}\n\n---\n既存タグ候補: ${[...existing].slice(0, 50).join(", ") || "(なし)"}`,
      },
    ],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const match = text.match(/\[[\s\S]*\]/);
  let tags: string[] = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string").slice(0, 6);
    } catch {}
  }
  return NextResponse.json({ tags });
}
