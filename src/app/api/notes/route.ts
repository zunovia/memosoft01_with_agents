import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  let query = supabase
    .from("notes")
    .select("id, title, updated_at, tags")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (q && q.trim()) {
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
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
