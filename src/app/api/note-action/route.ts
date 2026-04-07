import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

type Action = "summarize" | "expand" | "polish" | "translate-en" | "translate-ja" | "outline";

const PROMPTS: Record<Action, string> = {
  summarize: "次のノートを3〜5行のMarkdown箇条書きで要約してください。",
  expand: "次のノートを、構造を保ったまま例や詳細を補ってより充実させてください。Markdown出力。",
  polish: "次のノートの文章を、内容を変えずに読みやすく推敲してください。Markdown出力。",
  "translate-en": "次のノートを自然な英語に翻訳してください。Markdown構造は保持。",
  "translate-ja": "次のノートを自然な日本語に翻訳してください。Markdown構造は保持。",
  outline: "次のノートの内容から、Markdown見出し(##)とサブ箇条書きで論理的なアウトラインを生成してください。",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action: Action = body.action;
  const content: string = typeof body.content === "string" ? body.content : "";
  const title: string = typeof body.title === "string" ? body.title : "";
  if (!PROMPTS[action]) return NextResponse.json({ error: "invalid action" }, { status: 400 });
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
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: "あなたは優秀なノート編集アシスタントです。要求されたタスクのみを実行し、余計な前置きや説明は出力しないでください。",
    messages: [
      {
        role: "user",
        content: `${PROMPTS[action]}\n\n# ${title}\n\n${content}`,
      },
    ],
  });

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
