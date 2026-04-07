import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sourceNoteIds, types, resultMarkdown } = await req.json();
  if (!Array.isArray(sourceNoteIds) || typeof resultMarkdown !== "string") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Look up source titles for backlinks
  const { data: sources } = await supabase
    .from("notes")
    .select("id, title")
    .eq("user_id", user.id)
    .in("id", sourceNoteIds);

  const backlinkLines = (sources ?? [])
    .map((s) => `- [[${s.title}]]`)
    .join("\n");
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const title = `解析結果 - ${ts}`;
  const content = `## 元ノート\n${backlinkLines}\n\n---\n\n${resultMarkdown}`;

  const { data: note, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title, content, tags: ["analysis"] })
    .select("id, title")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("analyses").insert({
    user_id: user.id,
    source_note_ids: sourceNoteIds,
    types: Array.isArray(types) ? types : [],
    result: { markdown: resultMarkdown, saved_note_id: note.id },
  });

  // create links rows
  if (sources && sources.length) {
    const rows = sources.map((s) => ({
      user_id: user.id,
      source_note_id: note.id,
      target_note_id: s.id,
    }));
    await supabase.from("links").upsert(rows, {
      onConflict: "source_note_id,target_note_id",
      ignoreDuplicates: true,
    });
  }

  return NextResponse.json({ note });
}
