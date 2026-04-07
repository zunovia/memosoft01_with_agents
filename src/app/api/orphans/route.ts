import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const { data: links } = await supabase
    .from("links")
    .select("source_note_id, target_note_id")
    .eq("user_id", user.id);

  const linked = new Set<string>();
  (links ?? []).forEach((l: { source_note_id: string; target_note_id: string }) => {
    linked.add(l.source_note_id);
    linked.add(l.target_note_id);
  });
  const orphans = (notes ?? []).filter((n) => !linked.has(n.id));
  return NextResponse.json({ orphans });
}
