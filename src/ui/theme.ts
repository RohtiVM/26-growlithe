/**
 * Temas do Growlithe — fonte única das cores.
 *
 * - Tema escuro: vermelho #FF422A, preto e branco.
 * - Tema claro: cores da bandeira do Tocantins (azul, branco, amarelo).
 *
 * `satisfies` garante que os DOIS temas definem TODOS os tokens: esquecer um
 * token num tema é erro de compilação, não um botão invisível em produção.
 */

export const THEME_NAMES = ["escuro", "claro"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_TOKENS = [
  "background", // fundo da tela
  "surface", // cartões
  "surfaceAlt", // chips, áreas internas
  "border",
  "text",
  "textMuted",
  "primary", // botões, progresso, links
  "onPrimary", // texto sobre `primary`
  "highlight", // Missão Relâmpago
  "onHighlight", // texto sobre `highlight`
  "success", // presença no shopping, confirmações
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

type Hex = `#${string}`;

export const THEMES = {
  escuro: {
    background: "#000000",
    surface: "#161616",
    surfaceAlt: "#222222",
    border: "#303030",
    text: "#FFFFFF",
    textMuted: "#A6A6A6",
    primary: "#FF422A",
    onPrimary: "#000000",
    highlight: "#FFFFFF",
    onHighlight: "#000000",
    success: "#FFFFFF",
  },
  claro: {
    background: "#FFFFFF",
    surface: "#F3F6FC",
    surfaceAlt: "#E4EBF8",
    border: "#D3DCEE",
    text: "#0E1B3D",
    textMuted: "#4A5878",
    primary: "#1B47B4",
    onPrimary: "#FFFFFF",
    highlight: "#FDD700",
    onHighlight: "#0E1B3D",
    success: "#1E7F47",
  },
} as const satisfies Record<ThemeName, Record<ThemeToken, Hex>>;

/** Variáveis CSS para o Tailwind: `bg-[var(--color-primary)]` ou tokens no tailwind.config. */
export const themeCss = (name: ThemeName): string =>
  THEME_TOKENS.map((token) => `--color-${token}: ${THEMES[name][token]};`).join("\n");

/* ------------------------------------------------------------------ */
/* Contraste (WCAG 2.x) — as combinações que a interface realmente usa */
/* ------------------------------------------------------------------ */

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: Hex): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

export const contrastRatio = (a: Hex, b: Hex): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

/** Pares texto/fundo usados nas telas; o mínimo AA para texto é 4,5:1. */
export const CONTRAST_PAIRS = [
  ["text", "background"],
  ["text", "surface"],
  ["textMuted", "background"],
  ["textMuted", "surface"],
  ["primary", "background"], // links
  ["primary", "surface"],
  ["onPrimary", "primary"], // botões
  ["onHighlight", "highlight"], // Missão Relâmpago
] as const satisfies ReadonlyArray<readonly [ThemeToken, ThemeToken]>;
