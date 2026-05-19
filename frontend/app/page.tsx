"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen, Zap } from "lucide-react";
import { Animation, AppView } from "@/lib/types";
import { saveToLibrary } from "@/lib/utils";
import GenerateView from "@/components/GenerateView";
import LibraryView from "@/components/LibraryView";

export default function Home() {
  const [view, setView] = useState<AppView>("generate");
  const [currentAnimation, setCurrentAnimation] = useState<Animation | null>(null);
  const [libraryRefresh, setLibraryRefresh] = useState(0);

  const handleGenerated = useCallback((animation: Animation) => {
    setCurrentAnimation(animation);
  }, []);

  const handleSaveToLibrary = useCallback((animation: Animation) => {
    saveToLibrary(animation);
    setLibraryRefresh((n) => n + 1);
  }, []);

  const handleOpenFromLibrary = useCallback((animation: Animation) => {
    setCurrentAnimation(animation);
    setView("generate");
  }, []);

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--bg)" }}>
      {/* Top Nav */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c6aff, #ff6a9e)" }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Ani<span style={{ color: "var(--accent)" }}>Mind</span>
          </span>
        </div>

        <nav className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg)" }}>
          {[
            { id: "generate" as AppView, label: "Generate", icon: Sparkles },
            { id: "library" as AppView, label: "Library", icon: BookOpen },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: view === id ? "var(--accent)" : "transparent",
                color: view === id ? "white" : "var(--muted)",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        <div className="text-xs font-mono" style={{ color: "var(--muted)" }}>
          Powered by Claude
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "generate" ? (
            <motion.div
              key="generate"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <GenerateView
                currentAnimation={currentAnimation}
                onGenerated={handleGenerated}
                onSave={handleSaveToLibrary}
              />
            </motion.div>
          ) : (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <LibraryView
                refresh={libraryRefresh}
                onOpen={handleOpenFromLibrary}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
