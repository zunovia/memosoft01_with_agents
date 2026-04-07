"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const r = await fetch("/api/settings/api-key");
    const j = await r.json();
    setHasKey(!!j.hasKey);
    setUpdatedAt(j.updatedAt ?? null);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    const r = await fetch("/api/settings/api-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) {
      setErr(j.error || "保存に失敗しました");
      return;
    }
    setMsg("保存しました");
    setApiKey("");
    refresh();
  }

  async function remove() {
    if (!confirm("APIキーを削除しますか？")) return;
    await fetch("/api/settings/api-key", { method: "DELETE" });
    refresh();
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">設定</h1>
        <Link href="/notes" className="text-blue-500 underline text-sm">
          ← ノート一覧へ
        </Link>
      </div>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Anthropic APIキー</h2>
        <p className="text-sm opacity-70">
          AI解析機能を使うために必要です。
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 underline ml-1"
          >
            console.anthropic.comで取得
          </a>
        </p>
        <p className="text-sm">
          状態:{" "}
          {hasKey ? (
            <span className="text-green-500">設定済み{updatedAt ? ` (${new Date(updatedAt).toLocaleString()})` : ""}</span>
          ) : (
            <span className="text-yellow-500">未設定</span>
          )}
        </p>
        <form onSubmit={save} className="space-y-3">
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-transparent font-mono text-sm"
          />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          {msg && <p className="text-green-500 text-sm">{msg}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !apiKey}
              className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? "保存中..." : "保存"}
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={remove}
                className="border rounded px-4 py-2"
              >
                削除
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="border rounded-lg p-4">
        <button onClick={logout} className="text-red-500 underline text-sm">
          ログアウト
        </button>
      </section>
    </div>
  );
}
