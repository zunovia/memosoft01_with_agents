import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title")
    .eq("user_id", user.id);
  const { data: links } = await supabase
    .from("links")
    .select("source_note_id, target_note_id")
    .eq("user_id", user.id);

  return NextResponse.json({
    nodes: (notes ?? []).map((n) => ({ id: n.id, title: n.title })),
    links: (links ?? []).map((l) => ({ source: l.source_note_id, target: l.target_note_id })),
  });
}
