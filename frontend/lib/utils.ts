import { Animation } from "./types";

const LIBRARY_KEY = "animind_library";

export function getLibrary(): Animation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToLibrary(animation: Animation): void {
  const library = getLibrary();
  const existing = library.findIndex((a) => a.id === animation.id);
  if (existing >= 0) {
    library[existing] = animation;
  } else {
    library.unshift(animation);
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function deleteFromLibrary(id: string): void {
  const library = getLibrary().filter((a) => a.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function downloadHTML(code: string, title: string): void {
  const blob = new Blob([code], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
