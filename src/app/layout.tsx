import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { themeCss } from "@/ui/theme";
import { THEME_BOOT_SCRIPT } from "@/ui/theme-preference";
import "./globals.css";

/** docs/01: títulos em Space Grotesk, textos em Inter. Servidas pelo próprio app (sem CLS, sem Google no navegador). */
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Growlithe — missões que fazem você voltar ao shopping",
  description:
    "Escaneie QR Codes, complete missões e troque pontos por estacionamento, descontos e experiências. Sem instalar nada.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

/**
 * Tema: claro (Tocantins) ou escuro (vermelho). Sem escolha, segue o celular;
 * o botão sol/lua grava `data-theme` no <html> e ele vence (spec 007).
 */
const themeStyles = `
:root { ${themeCss("claro")} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="claro"]) { ${themeCss("escuro")} color-scheme: dark; } }
:root[data-theme="escuro"] { ${themeCss("escuro")} color-scheme: dark; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: o script abaixo pode pôr `data-theme` antes de o React hidratar.
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <style>{themeStyles}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
