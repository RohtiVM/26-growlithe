import type { ReactNode } from "react";
import { Flame, Home, LayoutDashboard, ScanLine, Target } from "lucide-react";
import { ThemeToggle } from "@/ui/theme-toggle";

type Tab = "inicio" | "missoes" | "none";

/** Moldura do app do visitante: topo com marca e saldo, barra de abas embaixo (wireframe 01). */
export function VisitorShell({
  children,
  points,
  tab,
  staff = false,
}: {
  children: ReactNode;
  points?: number;
  tab: Tab;
  /** Admin ou lojista: mostra o atalho para o painel (spec 008). */
  staff?: boolean;
}) {
  return (
    <div className="v-shell">
      <header className="v-top">
        <a className="brand" href="/app">
          <Flame size={20} aria-hidden /> Growlithe
        </a>
        <div className="v-top-actions">
          {points !== undefined && <span className="v-points tabular">{points.toLocaleString("pt-BR")} pts</span>}
          {staff && (
            <a className="v-panel-link" href="/painel" aria-label="Abrir o painel do shopping" title="Painel do shopping">
              <LayoutDashboard size={20} aria-hidden />
            </a>
          )}
          <ThemeToggle />
        </div>
      </header>
      <main className="v-main">{children}</main>
      <nav className="v-tabs" aria-label="App">
        <a className="v-tab" href="/app" aria-current={tab === "inicio" ? "page" : undefined}>
          <Home size={22} aria-hidden />
          <span>Início</span>
        </a>
        <a className="v-scan" href="/app#escanear" aria-label="Como escanear">
          <ScanLine size={26} aria-hidden />
        </a>
        <a className="v-tab" href="/app/missoes" aria-current={tab === "missoes" ? "page" : undefined}>
          <Target size={22} aria-hidden />
          <span>Missões</span>
        </a>
      </nav>
    </div>
  );
}
