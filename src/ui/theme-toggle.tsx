"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemeName } from "./theme";
import { effectiveTheme, otherTheme, parseStoredTheme, THEME_STORAGE_KEY } from "./theme-preference";

const readStored = (): ThemeName | null => {
  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
};

/** Botão sol/lua (spec 007): troca o tema na hora e lembra a escolha neste aparelho. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { setTheme(effectiveTheme(readStored(), media.matches)); };
    sync();
    // Sem escolha salva, acompanha o celular se ele mudar de modo com a página aberta.
    media.addEventListener("change", sync);
    return () => { media.removeEventListener("change", sync); };
  }, []);

  const toggle = () => {
    if (theme === null) return;
    const next = otherTheme(theme);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Armazenamento bloqueado: troca só nesta página (critério 4).
    }
    setTheme(next);
  };

  // Antes de saber o tema atual, mostra o botão sem ícone trocado para não pular no layout.
  const label = theme === "escuro" ? "Usar tema claro" : "Usar tema escuro";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === "escuro" ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
}
