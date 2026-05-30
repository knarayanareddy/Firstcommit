import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

// ── Color themes ──
export type ThemeKey = "cyber" | "ember" | "aurora" | "phantom" | "sakura";

export interface ThemeMeta {
  key: ThemeKey;
  label: string;
  description: string;
  preview: { bg: string; primary: string; accent: string };
}

export const THEMES: ThemeMeta[] = [
  {
    key: "cyber",
    label: "Cyber Cyan",
    description: "Mission-control with cyan & purple accents",
    preview: { bg: "#0f1318", primary: "#22d3c5", accent: "#7c3aed" },
  },
  {
    key: "ember",
    label: "Ember",
    description: "Warm theme with amber & crimson tones",
    preview: { bg: "#141110", primary: "#f59e0b", accent: "#ef4444" },
  },
  {
    key: "aurora",
    label: "Aurora",
    description: "Deep space with emerald & teal glow",
    preview: { bg: "#0c1410", primary: "#10b981", accent: "#06b6d4" },
  },
  {
    key: "phantom",
    label: "Phantom",
    description: "Monochrome silver with cool blue accents",
    preview: { bg: "#111114", primary: "#a1a1aa", accent: "#6366f1" },
  },
  {
    key: "sakura",
    label: "Sakura",
    description: "Soft with rose & blush highlights",
    preview: { bg: "#141012", primary: "#f472b6", accent: "#c084fc" },
  },
];

// ── Mode (light / dark / system) ──
export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "rocketboard-theme";
const MODE_STORAGE_KEY = "rocketboard-mode";

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  resolvedMode: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "cyber",
  setTheme: () => {},
  mode: "dark",
  setMode: () => {},
  resolvedMode: "dark",
});

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // ── Color theme state ──
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && THEMES.some((t) => t.key === stored)) return stored as ThemeKey;
    } catch {}
    return "cyber";
  });

  // ── Mode state ──
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {}
    return "dark";
  });

  const [systemPref, setSystemPref] = useState<"light" | "dark">(getSystemPreference);

  const resolvedMode: "light" | "dark" = mode === "system" ? systemPref : mode;

  // Listen for OS theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Apply theme classes + persist
  useEffect(() => {
    const root = document.documentElement;

    // Add brief transition class
    root.classList.add("theme-transitioning");

    // Remove all color-theme classes, then add active
    THEMES.forEach((t) => root.classList.remove(`theme-${t.key}`));
    root.classList.add(`theme-${theme}`);

    // Toggle dark class based on resolved mode
    if (resolvedMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}

    // Remove transition class after animation completes
    const timeout = setTimeout(() => root.classList.remove("theme-transitioning"), 300);
    return () => clearTimeout(timeout);
  }, [theme, resolvedMode]);

  // Persist mode
  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const setTheme = useCallback((t: ThemeKey) => setThemeState(t), []);
  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
