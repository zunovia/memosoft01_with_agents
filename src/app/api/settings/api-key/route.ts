import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { apiKey } = await req.json();
  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("sk-")) {
    return NextResponse.json({ error: "invalid api key" }, { status: 400 });
  }

  const { ciphertext, iv } = encrypt(apiKey);
  const { error } = await supabase.from("api_keys").upsert({
    user_id: user.id,
    encrypted_anthropic_key: ciphertext,
    iv,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase.from("api_keys").select("updated_at").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ hasKey: !!data, updatedAt: data?.updated_at ?? null });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await supabase.from("api_keys").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
