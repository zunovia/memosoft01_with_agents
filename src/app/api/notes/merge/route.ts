import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTags } from "@/lib/wiki-link";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetId: string = body.targetId;
  const sourceIds: string[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
  if (!targetId || sourceIds.length === 0) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: target } = await supabase
    .from("notes")
    .select("title, content")
    .eq("id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "target not found" }, { status: 404 });

  const { data: sources } = await supabase
    .from("notes")
    .select("id, title, content")
    .in("id", sourceIds)
    .eq("user_id", user.id);

  let merged = target.content;
  (sources ?? []).forEach((s: { title: string; content: string }) => {
    merged += `\n\n---\n\n## ${s.title}\n\n${s.content}`;
  });

  await supabase
    .from("notes")
    .update({ content: merged, tags: extractTags(merged) })
    .eq("id", targetId)
    .eq("user_id", user.id);

  // soft delete sources
  await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", sourceIds)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, mergedCount: sources?.length ?? 0 });
}
