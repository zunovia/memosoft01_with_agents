import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (!count) return NextResponse.json({ error: "no notes" }, { status: 404 });

  const offset = Math.floor(Math.random() * count);
  const { data } = await supabase
    .from("notes")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .range(offset, offset);
  return NextResponse.json({ id: data?.[0]?.id });
}
