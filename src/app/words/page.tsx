"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type W = { word: string; count: number };

export default function WordsPage() {
  const [words, setWords] = useState<W[]>([]);

  useEffect(() => {
    fetch("/api/word-cloud").then((r) => r.json()).then((j) => setWords(j.words || []));
  }, []);

  const max = words[0]?.count || 1;

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">☁️ ワードクラウド</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 items-center justify-center">
          {words.map((w) => {
            const size = 0.7 + (w.count / max) * 2.3;
            return (
              <span
                key={w.word}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-default"
                style={{ fontSize: `${size}rem`, opacity: 0.5 + (w.count / max) * 0.5 }}
                title={`${w.count}回`}
              >{w.word}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
