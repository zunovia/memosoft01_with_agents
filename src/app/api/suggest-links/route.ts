import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const noteId: string = body.noteId;
  if (!noteId) return NextResponse.json({ error: "no noteId" }, { status: 400 });

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

  const { data: current } = await supabase
    .from("notes")
    .select("title, content")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: others } = await supabase
    .from("notes")
    .select("title, content")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .neq("id", noteId)
    .order("updated_at", { ascending: false })
    .limit(80);

  const candidates = (others ?? [])
    .map((n: { title: string; content: string }) => `- "${n.title}": ${n.content.slice(0, 200).replace(/\n/g, " ")}`)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system:
      "あなたはノート間の関連性を見つけるアシスタントです。出力はJSON配列のみ、説明文は不要です。例: [\"note title 1\", \"note title 2\"]",
    messages: [
      {
        role: "user",
        content: `現在のノートと関連の深い候補ノートのタイトルを最大5件、JSON配列で返してください。タイトルは候補リストの中から正確に選ぶこと。

# 現在のノート
## ${current.title}
${current.content.slice(0, 2500)}

# 候補ノート
${candidates}`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const m = text.match(/\[[\s\S]*\]/);
  let titles: string[] = [];
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) titles = arr.filter((s) => typeof s === "string");
    } catch {}
  }
  return NextResponse.json({ titles });
}
