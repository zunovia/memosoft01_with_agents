import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content, tags, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), notes: data ?? [] }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="notes-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const list: { title?: string; content?: string; tags?: string[] }[] = Array.isArray(body?.notes)
    ? body.notes
    : [];
  if (list.length === 0) return NextResponse.json({ error: "no notes" }, { status: 400 });

  const rows = list.slice(0, 1000).map((n) => ({
    user_id: user.id,
    title: typeof n.title === "string" ? n.title : "Untitled",
    content: typeof n.content === "string" ? n.content : "",
    tags: Array.isArray(n.tags) ? n.tags : [],
  }));

  const { data, error } = await supabase.from("notes").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
