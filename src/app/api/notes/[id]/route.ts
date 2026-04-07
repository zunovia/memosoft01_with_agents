import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractWikiLinks, extractTags } from "@/lib/wiki-link";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: note, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  // backlinks: notes that link TO this one
  const { data: backlinkRows } = await supabase
    .from("links")
    .select("source_note_id")
    .eq("target_note_id", id)
    .eq("user_id", user.id);

  let backlinks: { id: string; title: string }[] = [];
  if (backlinkRows && backlinkRows.length) {
    const ids = backlinkRows.map((r) => r.source_note_id);
    const { data: bl } = await supabase
      .from("notes")
      .select("id, title")
      .in("id", ids);
    backlinks = bl ?? [];
  }

  return NextResponse.json({ note, backlinks });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") {
    updates.content = body.content;
    updates.tags = extractTags(body.content);
  }

  const { data: note, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // recompute links if content changed
  if (typeof body.content === "string") {
    const linkTitles = extractWikiLinks(body.content);
    await supabase.from("links").delete().eq("source_note_id", id).eq("user_id", user.id);
    if (linkTitles.length) {
      const { data: matches } = await supabase
        .from("notes")
        .select("id, title")
        .eq("user_id", user.id)
        .in("title", linkTitles);
      const lowerMap = new Map<string, string>();
      (matches ?? []).forEach((m) => lowerMap.set(m.title.toLowerCase(), m.id));
      // also do case-insensitive fallback by fetching candidates
      const missing = linkTitles.filter((t) => !lowerMap.has(t.toLowerCase()));
      if (missing.length) {
        for (const t of missing) {
          const { data: ci } = await supabase
            .from("notes")
            .select("id, title")
            .eq("user_id", user.id)
            .ilike("title", t)
            .limit(1)
            .maybeSingle();
          if (ci) lowerMap.set(t.toLowerCase(), ci.id);
        }
      }
      const rows = [...new Set([...lowerMap.values()])]
        .filter((tid) => tid !== id)
        .map((tid) => ({
          user_id: user.id,
          source_note_id: id,
          target_note_id: tid,
        }));
      if (rows.length) {
        await supabase.from("links").upsert(rows, {
          onConflict: "source_note_id,target_note_id",
          ignoreDuplicates: true,
        });
      }
    }
  }

  return NextResponse.json({ note });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
