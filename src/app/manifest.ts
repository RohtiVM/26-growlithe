import type { MetadataRoute } from "next";

/** Permite adicionar o Growlithe à tela inicial (e receber push no iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Growlithe — missões no shopping",
    short_name: "Growlithe",
    description: "Escaneie QR Codes, complete missões e troque pontos por prêmios.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "pt-BR",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
