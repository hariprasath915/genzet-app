"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  RotateCcw,
  Maximize2,
  Download,
  Copy,
  Check,
  Code2,
  Eye,
  BookmarkPlus,
  X,
} from "lucide-react";
import { Animation } from "@/lib/types";
import { downloadHTML } from "@/lib/utils";

interface Props {
  animation: Animation;
  onSave?: (animation: Animation) => void;
  showSaveButton?: boolean;
}

export default function AnimationPreview({ animation, onSave, showSaveButton = true }: Props) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRestart = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(animation.animation_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [animation.animation_code]);

  const handleDownload = useCallback(() => {
    downloadHTML(animation.animation_code, animation.title);
  }, [animation]);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>
              {animation.title}
            </h3>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--muted)" }}>
              {animation.explanation}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab toggle */}
            <div
              className="flex items-center rounded-lg p-0.5 gap-0.5"
              style={{ background: "var(--bg)" }}
            >
              {[
                { id: "preview" as const, icon: Eye, label: "Preview" },
                { id: "code" as const, icon: Code2, label: "Code" },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: tab === id ? "var(--accent)" : "transparent",
                    color: tab === id ? "white" : "var(--muted)",
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={handleRestart}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: "var(--bg)", color: "var(--muted)" }}
              title="Restart"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: "var(--bg)", color: "var(--muted)" }}
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: "var(--bg)", color: "var(--muted)" }}
              title="Copy code"
            >
              {copied ? <Check size={14} style={{ color: "#4ade80" }} /> : <Copy size={14} />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{ background: "var(--bg)", color: "var(--muted)" }}
              title="Download HTML"
            >
              <Download size={14} />
            </button>
            {showSaveButton && onSave && (
              <button
                onClick={() => onSave(animation)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(124,106,255,0.15)",
                  color: "var(--accent)",
                  border: "1px solid rgba(124,106,255,0.3)",
                }}
              >
                <BookmarkPlus size={12} />
                Save
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {tab === "preview" ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={animation.animation_code}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
              title={animation.title}
            />
          ) : (
            <div className="h-full overflow-auto p-4" style={{ background: "#0a0a10" }}>
              <pre
                className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all"
                style={{ color: "#a8b4d0" }}
              >
                {animation.animation_code}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "#000" }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <span className="font-semibold text-sm">{animation.title}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="p-2 rounded-lg hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              <X size={16} />
            </button>
          </div>
          <iframe
            key={`fs-${iframeKey}`}
            srcDoc={animation.animation_code}
            sandbox="allow-scripts"
            className="flex-1 w-full border-0"
            title={animation.title}
          />
        </motion.div>
      )}
    </>
  );
}
