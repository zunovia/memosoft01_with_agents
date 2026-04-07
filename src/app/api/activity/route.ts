import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 365);

  const { data } = await supabase
    .from("notes")
    .select("updated_at")
    .eq("user_id", user.id)
    .gte("updated_at", since.toISOString());

  const counts: Record<string, number> = {};
  (data ?? []).forEach((r: { updated_at: string }) => {
    const day = r.updated_at.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  });
  return NextResponse.json({ counts });
}
