import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { themeCss } from "@/ui/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: "Growlithe — missões que fazem você voltar ao shopping",
  description:
    "Escaneie QR Codes, complete missões e troque pontos por estacionamento, descontos e experiências. Sem instalar nada.",
  appleWebApp: { capable: true, title: "Growlithe", statusBarStyle: "black-translucent" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
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

/** O app segue o modo do celular: escuro (vermelho) ou claro (Tocantins). */
const themeStyles = `
:root { ${themeCss("claro")} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { ${themeCss("escuro")} color-scheme: dark; } }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable}`}>
      <head>
        <style>{themeStyles}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
