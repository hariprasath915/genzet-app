"use client";

import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Wand2, BookmarkPlus, Check } from "lucide-react";
import { Animation, GenerateResponse } from "@/lib/types";
import AnimationPreview from "./AnimationPreview";

interface Props {
  currentAnimation: Animation | null;
  onGenerated: (animation: Animation) => void;
  onSave: (animation: Animation) => void;
}

const EXAMPLE_PROMPTS = [
  "Photosynthesis in plants",
  "How gravity works",
  "DNA replication",
  "Water cycle",
  "Solar system orbits",
  "Mitosis cell division",
  "Neural network learning",
  "French Revolution causes",
  "Human heart blood flow",
  "Newton's Laws of Motion",
  "Acid base reactions",
  "Black hole formation",
];

const LOADING_MESSAGES = [
  "🧠 Analyzing your topic...",
  "🎨 Designing animations...",
  "⚡ Building canvas simulations...",
  "🔬 Adding scientific accuracy...",
  "✨ Polishing the visuals...",
  "🎬 Almost ready...",
];

export default function GenerateView({ currentAnimation, onGenerated, onSave }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLoadingAnimation = () => {
    let msgIdx = 0;
    let prog = 0;

    msgIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 3000);

    progressIntervalRef.current = setInterval(() => {
      prog = Math.min(prog + Math.random() * 4, 88);
      setProgress(prog);
    }, 400);
  };

  const stopLoadingAnimation = () => {
    if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
  };

  const handleGenerate = async (customPrompt?: string) => {
    const p = customPrompt || prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    setError("");
    setSaved(false);
    setProgress(0);
    setLoadingMsg(LOADING_MESSAGES[0]);
    startLoadingAnimation();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Generation failed");
      }

      const data: GenerateResponse = await res.json();
      stopLoadingAnimation();

      const animation: Animation = {
        id: uuidv4(),
        title: data.title,
        prompt: p,
        explanation: data.explanation,
        animation_code: data.animation_code,
        created_at: new Date().toISOString(),
      };
      onGenerated(animation);
      setPrompt("");
    } catch (e: unknown) {
      stopLoadingAnimation();
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const handleSave = () => {
    if (!currentAnimation) return;
    onSave(currentAnimation);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-96 flex flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>

        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Wand2 size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>Generate Animation</h2>
          </div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Describe any concept — Claude animates it like a YouTube video
          </p>
        </div>

        {/* Input */}
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Explain photosynthesis with animation..."
              rows={4}
              disabled={loading}
              className="w-full p-4 text-sm resize-none outline-none font-sans"
              style={{ background: "transparent", color: "var(--text)" }}
            />
            <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{prompt.length}/500</span>
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)", color: "white" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "var(--accent)" }}>{loadingMsg}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--accent), #a855f7)" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 rounded-lg text-xs"
              style={{ background: "rgba(255,100,100,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,100,100,0.2)" }}
            >
              ⚠ {error}
            </motion.div>
          )}
        </div>

        {/* Examples */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: "var(--muted)" }}>Try these</p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => handleGenerate(ex)}
                disabled={loading}
                className="text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 hover:translate-x-1 disabled:opacity-40"
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--accent)" }}>→</span> {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <AnimatePresence>
          {currentAnimation && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                style={{
                  background: saved ? "rgba(74,222,128,0.15)" : "rgba(124,106,255,0.15)",
                  color: saved ? "#4ade80" : "var(--accent)",
                  border: `1px solid ${saved ? "rgba(74,222,128,0.3)" : "rgba(124,106,255,0.3)"}`,
                }}
              >
                {saved ? <Check size={16} /> : <BookmarkPlus size={16} />}
                {saved ? "Saved to Library!" : "Save to Library"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right preview */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6"
            >
              {/* Animated visualization */}
              <div className="relative w-28 h-28">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full"
                    style={{ border: "2px solid var(--accent)", opacity: 0.3 - i * 0.08 }}
                    animate={{ scale: [1, 1.5 + i * 0.3, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
                <div
                  className="absolute inset-6 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: "linear-gradient(135deg, var(--accent), #a855f7)" }}
                >
                  🎬
                </div>
              </div>
              <div className="text-center max-w-xs">
                <motion.p
                  key={loadingMsg}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-semibold text-base mb-1"
                  style={{ color: "var(--text)" }}
                >
                  {loadingMsg}
                </motion.p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Claude is creating a YouTube-style animation for you
                </p>
              </div>
              {/* Mini progress */}
              <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--accent), #a855f7)" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          ) : currentAnimation ? (
            <motion.div
              key={currentAnimation.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              <AnimationPreview animation={currentAnimation} onSave={onSave} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4"
              style={{ color: "var(--muted)" }}
            >
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Wand2 size={36} style={{ color: "var(--border)" }} />
              </div>
              <p className="font-medium text-sm">Your animation will appear here</p>
              <p className="text-xs opacity-60">Enter any topic and click Generate</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}