"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trash2, Play, Download, Search, Library, Plus, X, Eye, Code2, Check, Upload, BookmarkPlus } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Animation } from "@/lib/types";
import { getLibrary, deleteFromLibrary, downloadHTML, formatDate, saveToLibrary } from "@/lib/utils";
import AnimationPreview from "./AnimationPreview";

interface Props {
  refresh: number;
  onOpen: (animation: Animation) => void;
}

export default function LibraryView({ refresh, onOpen }: Props) {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [selected, setSelected] = useState<Animation | null>(null);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Import modal state
  const [importTitle, setImportTitle] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importTab, setImportTab] = useState<"code" | "preview">("code");
  const [importSaved, setImportSaved] = useState(false);

  useEffect(() => {
    setAnimations(getLibrary());
  }, [refresh]);

  const refreshList = () => setAnimations(getLibrary());

  const handleImportSave = () => {
    if (!importCode.trim()) return;
    const newAnim: Animation = {
      id: uuidv4(),
      title: importTitle.trim() || "Untitled HTML",
      prompt: "(Manually imported HTML)",
      explanation: "Custom HTML code imported by user.",
      animation_code: importCode,
      created_at: new Date().toISOString(),
    };
    saveToLibrary(newAnim);
    refreshList();
    setImportSaved(true);
    setTimeout(() => {
      setImportSaved(false);
      setShowImport(false);
      setImportTitle("");
      setImportCode("");
      setImportTab("code");
    }, 1200);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFromLibrary(id);
    setAnimations(getLibrary());
    if (selected?.id === id) setSelected(null);
  };

  const filtered = animations.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Sidebar list */}
      <div
        className="w-80 flex flex-col border-r"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Library size={16} style={{ color: "var(--accent)" }} />
            <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>
              My Library
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: "var(--bg)", color: "var(--muted)" }}
            >
              {animations.length}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowImport(true)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(124,106,255,0.2), rgba(255,106,158,0.2))",
                color: "var(--accent)",
                border: "1px solid rgba(124,106,255,0.35)",
              }}
              title="Import HTML code to library"
            >
              <Plus size={11} />
              Import HTML
            </motion.button>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
          >
            <Search size={13} style={{ color: "var(--muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search animations..."
              className="flex-1 text-xs outline-none bg-transparent"
              style={{ color: "var(--text)" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <BookOpen size={32} style={{ color: "var(--border)" }} />
              <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                {search ? "No results found" : "No saved animations yet.\nGenerate and save one!"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((anim) => (
                <motion.div
                  key={anim.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelected(anim)}
                  className="p-3 rounded-xl cursor-pointer transition-all duration-150 group"
                  style={{
                    background: selected?.id === anim.id ? "rgba(124,106,255,0.15)" : "var(--bg)",
                    border: `1px solid ${selected?.id === anim.id ? "rgba(124,106,255,0.4)" : "var(--border)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs truncate" style={{ color: "var(--text)" }}>
                        {anim.title}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                        {anim.prompt}
                      </p>
                      <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)", opacity: 0.6, fontSize: "10px" }}>
                        {formatDate(anim.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(anim.id, e)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "#ff6b6b", background: "rgba(255,107,107,0.1)" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {selected?.id === anim.id && (
                    <div className="flex gap-2 mt-2 pt-2 border-t" style={{ borderColor: "rgba(124,106,255,0.2)" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpen(anim); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-1 justify-center"
                        style={{ background: "var(--accent)", color: "white" }}
                      >
                        <Play size={10} /> Open
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadHTML(anim.animation_code, anim.title); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border)" }}
                      >
                        <Download size={10} />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Import HTML Modal ── */}
      <AnimatePresence>
        {showImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowImport(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="w-full max-w-3xl flex flex-col rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                maxHeight: "85vh",
              }}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #7c6aff, #ff6a9e)" }}
                  >
                    <Upload size={15} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>
                      Import HTML to Library
                    </h3>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Paste any HTML code and save it for instant preview
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImport(false)}
                  className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: "var(--muted)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-0 flex-1 overflow-hidden">
                {/* Title input */}
                <div className="px-5 pt-4 pb-3">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
                    TITLE
                  </label>
                  <input
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="e.g. Solar System Animation"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                {/* Tab bar */}
                <div
                  className="flex items-center gap-1 px-5 pb-2"
                >
                  {([
                    { id: "code" as const, icon: Code2, label: "HTML Code" },
                    { id: "preview" as const, icon: Eye, label: "Live Preview" },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setImportTab(id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: importTab === id ? "var(--accent)" : "var(--bg)",
                        color: importTab === id ? "white" : "var(--muted)",
                        border: importTab === id ? "none" : "1px solid var(--border)",
                      }}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Code / Preview area */}
                <div className="flex-1 overflow-hidden mx-5 mb-4 rounded-xl" style={{ border: "1px solid var(--border)", minHeight: "260px", maxHeight: "340px" }}>
                  {importTab === "code" ? (
                    <textarea
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder={`Paste your full HTML code here...\n\n<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>`}
                      className="w-full h-full p-4 text-xs font-mono outline-none resize-none"
                      style={{
                        background: "#0a0a14",
                        color: "#a8b4d0",
                        lineHeight: 1.6,
                        minHeight: "260px",
                      }}
                    />
                  ) : (
                    <iframe
                      key={importCode}
                      srcDoc={importCode || "<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;background:#0a0a14;'><p>Paste HTML code first to see a preview</p></body></html>"}
                      sandbox="allow-scripts"
                      className="w-full border-0"
                      style={{ height: "100%", minHeight: "260px" }}
                      title="HTML Preview"
                    />
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                className="flex items-center justify-between px-5 py-4 border-t"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              >
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {importCode.trim()
                    ? `${importCode.length.toLocaleString()} characters · ready to save`
                    : "Paste HTML code above to get started"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowImport(false)}
                    className="px-4 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleImportSave}
                    disabled={!importCode.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: importCode.trim()
                        ? "linear-gradient(135deg, #7c6aff, #ff6a9e)"
                        : "var(--border)",
                      color: importCode.trim() ? "white" : "var(--muted)",
                      cursor: importCode.trim() ? "pointer" : "not-allowed",
                      boxShadow: importCode.trim() ? "0 4px 20px rgba(124,106,255,0.4)" : "none",
                    }}
                  >
                    {importSaved ? (
                      <><Check size={14} /> Saved!</>
                    ) : (
                      <><BookmarkPlus size={14} /> Save to Library</>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview panel */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <AnimationPreview
                animation={selected}
                showSaveButton={false}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-4"
              style={{ color: "var(--muted)" }}
            >
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Play size={36} style={{ color: "var(--border)" }} />
              </div>
              <p className="font-medium text-sm">Select an animation to preview</p>
              <p className="text-xs opacity-60">Click any saved animation from the list</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
