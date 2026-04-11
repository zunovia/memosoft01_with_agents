"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = { id: string; title: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[] };
type VoicevoxSpeaker = { name: string; styles: { name: string; id: number }[] };
type TtsEngine = "browser" | "voicevox";

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // TTS engine state
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>("browser");
  const [voicevoxAvailable, setVoicevoxAvailable] = useState(false);
  const [speakerId, setSpeakerId] = useState(14); // 冥鳴ひまり
  const [speakers, setSpeakers] = useState<VoicevoxSpeaker[]>([]);
  const [showTtsSettings, setShowTtsSettings] = useState(false);

  // VOICEVOX検出
  const checkVoicevox = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:50021/speakers", { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data: VoicevoxSpeaker[] = await res.json();
        setSpeakers(data);
        setVoicevoxAvailable(true);
        setTtsEngine("voicevox");
        return;
      }
    } catch {}
    setVoicevoxAvailable(false);
    setTtsEngine("browser");
  }, []);

  useEffect(() => {
    checkVoicevox();
    const interval = setInterval(checkVoicevox, 30000);
    return () => clearInterval(interval);
  }, [checkVoicevox]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: Source[] | undefined;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!sources && buffer.startsWith("__SOURCES__")) {
          const nl = buffer.indexOf("\n\n");
          if (nl > 0) {
            try {
              sources = JSON.parse(buffer.slice("__SOURCES__".length, nl));
            } catch {}
            buffer = buffer.slice(nl + 2);
          }
        }
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: buffer,
            sources,
          };
          return next;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: `エラー: ${(e as Error).message}` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  // Auto-speak when streaming finishes
  const prevStreaming = useRef(streaming);
  useEffect(() => {
    if (prevStreaming.current && !streaming && autoSpeak) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content) {
        handleSpeak(messages.length - 1, last.content);
      }
    }
    prevStreaming.current = streaming;
  }, [streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanText(text: string) {
    return text
      .replace(/```[\s\S]*?```/g, "コードブロック省略。")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~>|=-]{2,}/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/\n{2,}/g, "。")
      .trim();
  }

  async function speakWithVoicevox(clean: string) {
    const VOICEVOX = "http://localhost:50021";
    const queryRes = await fetch(
      `${VOICEVOX}/audio_query?text=${encodeURIComponent(clean)}&speaker=${speakerId}`,
      { method: "POST" }
    );
    if (!queryRes.ok) throw new Error("VOICEVOX audio_query failed");
    const query = await queryRes.json();
    const synthRes = await fetch(
      `${VOICEVOX}/synthesis?speaker=${speakerId}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) }
    );
    if (!synthRes.ok) throw new Error("VOICEVOX synthesis failed");
    const blob = await synthRes.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      setSpeakingIdx(null);
    };
    audio.play();
  }

  function speakWithBrowser(clean: string) {
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "ja-JP";
    utter.rate = 0.9;
    utter.onend = () => setSpeakingIdx(null);
    speechSynthesis.speak(utter);
  }

  async function handleSpeak(idx: number, text: string) {
    if (speakingIdx === idx) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(idx);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speechSynthesis.cancel();
    const clean = cleanText(text);
    if (ttsEngine === "voicevox") {
      try {
        await speakWithVoicevox(clean);
      } catch (e) {
        console.error("VOICEVOX error, falling back to Web Speech API:", e);
        setVoicevoxAvailable(false);
        setTtsEngine("browser");
        speakWithBrowser(clean);
      }
    } else {
      speakWithBrowser(clean);
    }
  }

  // 現在のキャラ名を取得
  const currentSpeakerName = speakers
    .flatMap((s) => s.styles.map((st) => ({ name: s.name, style: st.name, id: st.id })))
    .find((s) => s.id === speakerId);

  return (
    <div className="flex-1 flex flex-col h-[100dvh]">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/notes" className="text-sm hover:underline">← Notes</Link>
        <h1 className="font-semibold">💬 ノートとチャット</h1>
        <span className="text-xs text-zinc-500 ml-2 hidden md:inline">関連ノートを自動参照して回答します</span>
        <div className="ml-auto flex items-center gap-2">
          {/* TTS エンジン表示 */}
          <button
            onClick={() => setShowTtsSettings(!showTtsSettings)}
            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="読み上げ設定"
          >
            {ttsEngine === "voicevox" ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                VOICEVOX{currentSpeakerName ? ` (${currentSpeakerName.name})` : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                ブラウザ音声
              </span>
            )}
          </button>
          {/* 自動読み上げトグル */}
          <button
            onClick={() => {
              if (autoSpeak) {
                speechSynthesis.cancel();
                if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
              }
              setAutoSpeak(!autoSpeak);
            }}
            className={`text-xs px-2 py-1 rounded border ${autoSpeak ? "bg-blue-600 text-white border-blue-600" : "border-zinc-300 dark:border-zinc-700 text-zinc-500"}`}
            title="回答を自動で読み上げる"
          >{autoSpeak ? "🔊 自動読み上げON" : "🔇 自動読み上げOFF"}</button>
        </div>
      </div>

      {/* TTS設定パネル */}
      {showTtsSettings && (
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs font-medium">音声エンジン:</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                checked={ttsEngine === "browser"}
                onChange={() => setTtsEngine("browser")}
              />
              ブラウザ音声（インストール不要）
            </label>
            <label className={`flex items-center gap-1 text-xs cursor-pointer ${!voicevoxAvailable ? "opacity-40" : ""}`}>
              <input
                type="radio"
                checked={ttsEngine === "voicevox"}
                onChange={() => setTtsEngine("voicevox")}
                disabled={!voicevoxAvailable}
              />
              VOICEVOX（高品質）
              {!voicevoxAvailable && (
                <span className="text-red-500 ml-1">未検出</span>
              )}
            </label>
            {!voicevoxAvailable && (
              <a
                href="https://voicevox.hiroshiba.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >インストールはこちら →</a>
            )}
          </div>
          {ttsEngine === "voicevox" && voicevoxAvailable && speakers.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-xs font-medium">キャラクター:</span>
              <select
                value={speakerId}
                onChange={(e) => setSpeakerId(Number(e.target.value))}
                className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
              >
                {speakers.map((s) =>
                  s.styles.map((st) => (
                    <option key={st.id} value={st.id}>
                      {s.name} - {st.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-12">
            あなたのノートに質問してみましょう。
            <div className="mt-4 text-xs space-y-1 opacity-70">
              <div>例: 「最近書いたプロジェクトのアイデアをまとめて」</div>
              <div>例: 「#book タグの読書メモから共通する学びは?」</div>
              <div>例: 「先週のミーティングの決定事項を教えて」</div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 ${m.role === "user" ? "bg-blue-600 text-white ml-12" : "bg-zinc-100 dark:bg-zinc-900 mr-12"}`}
          >
            {m.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="not-prose flex justify-end -mb-1">
                  <button
                    onClick={() => handleSpeak(i, m.content)}
                    className="text-xs px-1.5 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
                    title={speakingIdx === i ? "読み上げ停止" : "読み上げ"}
                    disabled={!m.content || streaming}
                  >{speakingIdx === i ? "⏹ 停止" : "🔊 読む"}</button>
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "..."}</ReactMarkdown>
                {m.sources && m.sources.length > 0 && (
                  <div className="not-prose mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <span className="text-zinc-500">参照: </span>
                    {m.sources.map((s) => (
                      <Link
                        key={s.id}
                        href={`/notes/${s.id}`}
                        className="inline-block mr-2 px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 hover:underline"
                      >{s.title}</Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 max-w-3xl mx-auto w-full flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="質問を入力..."
          className="flex-1 px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >送信</button>
      </div>
    </div>
  );
}
