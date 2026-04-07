import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const withSnippet = url.searchParams.get("snippet") === "1";
  const trash = url.searchParams.get("trash") === "1";

  let query = supabase
    .from("notes")
    .select("id, title, updated_at, tags, content, pinned, deleted_at")
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(500);

  if (trash) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  if (q && q.trim()) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notes = (data ?? []).map((n) => {
    const out: Record<string, unknown> = {
      id: n.id,
      title: n.title,
      updated_at: n.updated_at,
      tags: n.tags,
      pinned: (n as { pinned?: boolean }).pinned ?? false,
      deleted_at: (n as { deleted_at?: string | null }).deleted_at ?? null,
    };
    if (withSnippet && typeof n.content === "string") {
      const stripped = n.content
        .replace(/[#*`_~>\[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      out.snippet = stripped.slice(0, 140);
    }
    return out;
  });

  return NextResponse.json({ notes });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title: "Untitled", content: "" })
    .select("id, title, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}
