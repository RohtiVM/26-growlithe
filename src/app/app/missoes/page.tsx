import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Route, Target, Zap } from "lucide-react";
import { getVisitor } from "@/server/visitor";
import { loadVisitorHome } from "@/visitor/data";
import { VisitorShell } from "@/visitor/visitor-shell";

export const metadata: Metadata = { title: "Missões · Growlithe" };
export const dynamic = "force-dynamic";

const endsInPalmas = (d: Date): string =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Araguaina" });

/** Lista de missões ativas com o progresso do visitante (D8). */
export default async function MissoesPage() {
  const visitor = await getVisitor();
  if (visitor.kind === "anonymous") redirect("/app/entrar?next=/app/missoes");
  if (visitor.name === "") redirect("/app/nome?next=/app/missoes");

  const { missions } = await loadVisitorHome(visitor.id);
  const open = missions.filter((m) => !m.done);
  const done = missions.filter((m) => m.done);

  return (
    <VisitorShell tab="missoes" points={visitor.points}>
      <div className="v-greeting reveal reveal-1">
        <h1>Missões</h1>
        <p className="lead">Complete missões pelo shopping e ganhe pontos extras.</p>
      </div>

      {missions.length === 0 && (
        <div className="empty reveal reveal-2">
          <Target size={28} aria-hidden />
          <strong>Nenhuma missão ativa agora</strong>
          <span>Fique de olho: Missões Relâmpago aparecem de surpresa.</span>
        </div>
      )}

      {open.length > 0 && (
        <ul className="list reveal reveal-2">
          {open.map((m) => {
            const Icon = m.flash ? Zap : Route;
            return (
              <li key={m.id} className={`card v-mission-row${m.flash ? " v-mission-flash" : ""}`}>
                <div className="list-item-main">
                  <span className="icon-tile"><Icon size={20} aria-hidden /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{m.title}</strong>
                    <p className="muted">{m.label}</p>
                  </div>
                  <span className="v-reward tabular">+{m.points}</span>
                </div>
                <div className="progress"><span style={{ width: `${Math.round((m.current / m.target) * 100)}%` }} /></div>
                <p className="muted v-mission-meta tabular">
                  {m.current} de {m.target} · até {endsInPalmas(m.endsAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <section className="reveal reveal-3">
          <h2 className="v-subtitle">Concluídas</h2>
          <ul className="list">
            {done.map((m) => (
              <li key={m.id} className="card list-item">
                <div className="list-item-main">
                  <span className="icon-tile icon-tile-success"><CheckCircle2 size={20} aria-hidden /></span>
                  <div>
                    <strong>{m.title}</strong>
                    <p className="muted tabular">+{m.points} pts ganhos</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </VisitorShell>
  );
}
