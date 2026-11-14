import type { Metadata } from "next";
import { Compass, Flame } from "lucide-react";

export const metadata: Metadata = { title: "Página não encontrada · Growlithe" };

export default function NotFound() {
  return (
    <main className="auth-shell">
      <div className="auth-card card reveal reveal-1">
        <a className="brand" href="/">
          <Flame size={20} aria-hidden /> Growlithe
        </a>
        <span className="icon-tile"><Compass size={22} aria-hidden /></span>
        <h1>Essa página se perdeu no shopping</h1>
        <p className="lead">O endereço não existe ou mudou. Volte para o início e continue de onde parou.</p>
        <div className="actions">
          <a className="btn" href="/">Ir para o início</a>
          <a className="btn btn-secondary" href="/app">Ver meus pontos</a>
        </div>
      </div>
    </main>
  );
}
