"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function ActivityPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/activity").then((r) => r.json()).then((j) => setCounts(j.counts || {}));
  }, []);

  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // start from 52 weeks ago, snap to Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);
    const w: { date: Date; key: string; count: number }[][] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const week: { date: Date; key: string; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const key = cur.toISOString().slice(0, 10);
        week.push({ date: new Date(cur), key, count: counts[key] ?? 0 });
        cur.setDate(cur.getDate() + 1);
      }
      w.push(week);
    }
    return w;
  }, [counts]);

  function color(c: number) {
    if (!c) return "bg-zinc-200 dark:bg-zinc-800";
    if (c < 2) return "bg-green-200 dark:bg-green-900";
    if (c < 5) return "bg-green-400 dark:bg-green-700";
    if (c < 10) return "bg-green-600 dark:bg-green-500";
    return "bg-green-800 dark:bg-green-300";
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeDays = Object.keys(counts).length;

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-y-auto">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">📊 アクティビティ</h1>
      </div>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          直近1年で <strong>{total}</strong> 件の更新 · <strong>{activeDays}</strong> 日アクティブ
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-1">
            {weeks.map((week, i) => (
              <div key={i} className="flex flex-col gap-1">
                {week.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.key}: ${d.count}件`}
                    className={`w-3 h-3 rounded-sm ${color(d.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <span>少</span>
          <div className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700" />
          <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-500" />
          <div className="w-3 h-3 rounded-sm bg-green-800 dark:bg-green-300" />
          <span>多</span>
        </div>
      </div>
    </div>
  );
}
