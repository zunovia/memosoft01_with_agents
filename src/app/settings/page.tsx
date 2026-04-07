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
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [tagFrom, setTagFrom] = useState("");
  const [tagTo, setTagTo] = useState("");
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{ notes: number; links: number; analyses: number; tags: number; chars: number } | null>(null);

  async function refresh() {
    const r = await fetch("/api/settings/api-key");
    const j = await r.json();
    setHasKey(!!j.hasKey);
    setUpdatedAt(j.updatedAt ?? null);
  }

  useEffect(() => {
    refresh();
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
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

      {stats && (
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-3">統計</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div><div className="text-2xl font-bold">{stats.notes}</div><div className="text-xs opacity-60">ノート</div></div>
            <div><div className="text-2xl font-bold">{stats.links}</div><div className="text-xs opacity-60">リンク</div></div>
            <div><div className="text-2xl font-bold">{stats.tags}</div><div className="text-xs opacity-60">タグ</div></div>
            <div><div className="text-2xl font-bold">{stats.analyses}</div><div className="text-xs opacity-60">解析履歴</div></div>
            <div><div className="text-2xl font-bold">{(stats.chars / 1000).toFixed(1)}k</div><div className="text-xs opacity-60">総文字数</div></div>
          </div>
        </section>
      )}

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

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">エクスポート / インポート</h2>
        <p className="text-sm opacity-70">全ノートをJSONでバックアップ・復元できます。</p>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/api/export"
            className="border rounded px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >ダウンロード (JSON)</a>
          <label className="border rounded px-4 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800">
            インポート (JSON)
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImportMsg("インポート中...");
                try {
                  const text = await f.text();
                  const parsed = JSON.parse(text);
                  const r = await fetch("/api/export", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ notes: parsed.notes || parsed }),
                  });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j.error || "import failed");
                  setImportMsg(`${j.imported}件インポートしました`);
                } catch (err) {
                  setImportMsg(`エラー: ${(err as Error).message}`);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {importMsg && <p className="text-sm text-zinc-500">{importMsg}</p>}
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">タグ一括リネーム</h2>
        <p className="text-sm opacity-70">全ノート内の <code>#旧</code> を <code>#新</code> に置換します。</p>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={tagFrom}
            onChange={(e) => setTagFrom(e.target.value)}
            placeholder="旧タグ (#なし)"
            className="border rounded px-3 py-1.5 text-sm bg-transparent"
          />
          <span>→</span>
          <input
            value={tagTo}
            onChange={(e) => setTagTo(e.target.value)}
            placeholder="新タグ"
            className="border rounded px-3 py-1.5 text-sm bg-transparent"
          />
          <button
            onClick={async () => {
              if (!tagFrom || !tagTo) return;
              setTagMsg("実行中...");
              const r = await fetch("/api/tags/rename", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ from: tagFrom, to: tagTo }),
              });
              const j = await r.json();
              setTagMsg(r.ok ? `${j.updated}件更新` : `エラー: ${j.error}`);
              if (r.ok) { setTagFrom(""); setTagTo(""); }
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded"
          >実行</button>
        </div>
        {tagMsg && <p className="text-sm text-zinc-500">{tagMsg}</p>}
      </section>

      <section className="border rounded-lg p-4">
        <button onClick={logout} className="text-red-500 underline text-sm">
          ログアウト
        </button>
      </section>
    </div>
  );
}
