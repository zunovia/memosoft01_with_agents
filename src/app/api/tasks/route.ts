import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notes")
    .select("id, title, content, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const tasks: { noteId: string; noteTitle: string; line: number; text: string; done: boolean }[] = [];
  (data ?? []).forEach((n: { id: string; title: string; content: string }) => {
    const lines = n.content.split("\n");
    lines.forEach((l, i) => {
      const m = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(l);
      if (m) {
        tasks.push({
          noteId: n.id,
          noteTitle: n.title,
          line: i,
          text: m[2].trim(),
          done: m[1].toLowerCase() === "x",
        });
      }
    });
  });
  return NextResponse.json({ tasks });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { noteId, line, done } = body as { noteId: string; line: number; done: boolean };
  if (typeof noteId !== "string" || typeof line !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { data: note } = await supabase
    .from("notes")
    .select("content")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lines = note.content.split("\n");
  if (line < 0 || line >= lines.length) return NextResponse.json({ error: "bad line" }, { status: 400 });
  lines[line] = lines[line].replace(/\[([ xX])\]/, `[${done ? "x" : " "}]`);
  const next = lines.join("\n");

  await supabase.from("notes").update({ content: next }).eq("id", noteId).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
