/**
 * Escolha de tema (spec 007). Regras puras; o botão e o script do <head>
 * só aplicam o resultado como `data-theme` no <html>.
 */
import type { ThemeName } from "./theme";

export const THEME_STORAGE_KEY = "gl_tema";

/** Valor salvo no aparelho → tema conhecido, ou `null` (nunca escolheu / valor adulterado). */
export const parseStoredTheme = (raw: string | null): ThemeName | null =>
  raw === "claro" || raw === "escuro" ? raw : null;

/** A escolha salva vence; sem escolha, segue o modo do celular (critério 3). */
export const effectiveTheme = (stored: ThemeName | null, systemPrefersDark: boolean): ThemeName =>
  stored ?? (systemPrefersDark ? "escuro" : "claro");

export const otherTheme = (theme: ThemeName): ThemeName => (theme === "escuro" ? "claro" : "escuro");

/**
 * Script mínimo do <head> (D3): aplica a escolha salva antes de a página
 * aparecer, para quem prefere o claro nunca ver o escuro piscar.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="claro"||t==="escuro")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
