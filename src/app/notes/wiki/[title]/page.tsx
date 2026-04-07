import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WikiResolver({
  params,
}: {
  params: Promise<{ title: string }>;
}) {
  const { title } = await params;
  const decoded = decodeURIComponent(title);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notes")
    .select("id")
    .eq("user_id", user.id)
    .ilike("title", decoded)
    .limit(1)
    .maybeSingle();

  if (data?.id) redirect(`/notes/${data.id}`);

  // Not found — create it
  const { data: created } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title: decoded, content: "" })
    .select("id")
    .single();
  if (created?.id) redirect(`/notes/${created.id}`);
  redirect("/notes");
}
