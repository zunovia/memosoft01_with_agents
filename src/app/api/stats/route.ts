import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ count: noteCount }, { count: linkCount }, { count: analysesCount }, { data: notes }] =
    await Promise.all([
      supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("links").select("source_note_id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("notes").select("tags, content").eq("user_id", user.id),
    ]);

  const tagSet = new Set<string>();
  let totalChars = 0;
  (notes ?? []).forEach((n: { tags?: string[]; content?: string }) => {
    (n.tags || []).forEach((t) => tagSet.add(t));
    if (typeof n.content === "string") totalChars += n.content.length;
  });

  return NextResponse.json({
    notes: noteCount ?? 0,
    links: linkCount ?? 0,
    analyses: analysesCount ?? 0,
    tags: tagSet.size,
    chars: totalChars,
  });
}
