import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","is","it","this","that","with","as","be","by","from","are","was","were","i","you","we","they","he","she","my","your","our","their","not","no","yes",
  "です","ます","する","した","して","いる","ある","これ","それ","あれ","この","その","あの","ない","から","まで","では","には","とも","また","ため","こと","もの","よう","なる","なっ","だっ","でし","ませ"
]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: notes } = await supabase
    .from("notes")
    .select("content")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(500);

  const counts = new Map<string, number>();
  (notes ?? []).forEach((n: { content: string }) => {
    const cleaned = n.content
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/[#*_>`~\-+=|{}[\]()<>:;,.!?「」『』、。…—]/g, " ");
    const tokens = cleaned.toLowerCase().split(/\s+/).filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t));
    tokens.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  });
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([word, count]) => ({ word, count }));
  return NextResponse.json({ words: top });
}
