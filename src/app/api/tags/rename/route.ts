import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTags } from "@/lib/wiki-link";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const from: string = (body.from || "").trim();
  const to: string = (body.to || "").trim();
  if (!from || !to) return NextResponse.json({ error: "from/to required" }, { status: 400 });

  const { data: notes } = await supabase
    .from("notes")
    .select("id, content")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .contains("tags", [from]);

  let updated = 0;
  for (const n of notes ?? []) {
    const re = new RegExp(`#${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
    const next = (n.content as string).replace(re, `#${to}`);
    if (next !== n.content) {
      await supabase
        .from("notes")
        .update({ content: next, tags: extractTags(next) })
        .eq("id", n.id)
        .eq("user_id", user.id);
      updated++;
    }
  }
  return NextResponse.json({ updated });
}
