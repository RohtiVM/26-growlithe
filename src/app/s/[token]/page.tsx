import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MapPin, PartyPopper, Route } from "lucide-react";
import { createSupabaseServerClient } from "@/server/supabase";
import { firstName, getVisitor } from "@/server/visitor";
import { scanOutcomeFromRow, TIER_LABEL } from "@/visitor/scan";
import { VisitorLoginForm } from "@/visitor/visitor-login-form";
import { VisitorShell } from "@/visitor/visitor-shell";

export const metadata: Metadata = { title: "QR Code · Growlithe" };
export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{20,600}$/;

/**
 * Link universal do QR (spec 004). A câmera nativa abre esta página; o banco
 * confere a assinatura e credita os pontos numa transação (`scan_checkpoint`).
 */
export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const here = `/s/${token}`;
  const visitor = await getVisitor();

  // D1: sem login, o primeiro scan vira o cadastro; o link mágico volta para cá.
  if (visitor.kind === "anonymous") {
    if (!TOKEN.test(token)) {
      return (
        <main className="auth-shell">
          <div className="auth-card card reveal reveal-1" role="alert">
            <span className="icon-tile"><AlertTriangle size={22} aria-hidden /></span>
            <h1>Esse QR Code não é do Growlithe</h1>
            <p className="lead">Procure os QR Codes com a marca Growlithe na entrada, nas lojas e nos eventos do shopping.</p>
            <a className="btn btn-block" href="/">Conhecer o Growlithe</a>
          </div>
        </main>
      );
    }
    return (
      <main className="auth-shell">
        <div className="auth-card card reveal reveal-1">
          <span className="icon-tile"><MapPin size={22} aria-hidden /></span>
          <h1>Você achou um ponto Growlithe!</h1>
          <p className="lead">Entre com seu e-mail para receber os pontos deste QR Code. Leva 10 segundos.</p>
          <VisitorLoginForm next={here} cta="Receber meus pontos" />
        </div>
      </main>
    );
  }

  // D13: o nome vem antes do primeiro resultado.
  if (visitor.name === "") redirect(`/app/nome?next=${encodeURIComponent(here)}`);

  const supabase = await createSupabaseServerClient();
  // Resposta crua do banco: só entra na tela depois do parse com Zod.
  const raw: unknown = TOKEN.test(token)
    ? (await supabase.rpc("scan_checkpoint", { p_token: token })).data
    : { result: "invalid_qr" };
  const outcome = scanOutcomeFromRow(raw);

  if (outcome.kind === "error") {
    const Icon = outcome.error === "already_scanned_today" ? Clock : AlertTriangle;
    return (
      <VisitorShell tab="none" points={visitor.points}>
        <section className="scan-result scan-result-error reveal reveal-1" role="alert">
          <span className="icon-tile"><Icon size={26} aria-hidden /></span>
          <h1>{outcome.error === "already_scanned_today" ? "Esse você já pegou hoje" : "Não deu certo"}</h1>
          <p className="lead">{outcome.message}</p>
          <a className="btn btn-block" href="/app">
            Ver meus pontos <ArrowRight size={18} aria-hidden />
          </a>
        </section>
      </VisitorShell>
    );
  }

  return (
    <VisitorShell tab="none" points={outcome.balance}>
      <section className="scan-result reveal reveal-1" aria-live="polite">
        {outcome.tierUp !== null ? (
          <div className="tier-up">
            <PartyPopper size={28} aria-hidden />
            <strong>Você subiu para {TIER_LABEL[outcome.tierUp]}!</strong>
          </div>
        ) : (
          <span className="icon-tile icon-tile-success"><CheckCircle2 size={26} aria-hidden /></span>
        )}
        <p className="scan-points tabular">+{outcome.pointsEarned} pts</p>
        <p className="scan-where">{outcome.isCheckin ? "Check-in feito" : "Ponto encontrado"} · {outcome.checkpoint}</p>
        <p className="lead">
          Boa, {firstName(visitor.name)}! Seu saldo agora é <strong className="tabular">{outcome.balance.toLocaleString("pt-BR")} pts</strong>.
        </p>

        {outcome.missions.length > 0 && (
          <ul className="list scan-missions">
            {outcome.missions.map((m) => (
              <li key={m.title} className="card list-item">
                <div className="list-item-main">
                  <span className="icon-tile"><Route size={20} aria-hidden /></span>
                  <div>
                    <strong>{m.title}</strong>
                    <p className="muted">
                      {m.status === "completed" && `Missão concluída! +${m.points} pts`}
                      {m.status === "progress" && `${m.current} de ${m.target} · continue procurando`}
                      {m.status === "out_of_order" &&
                        `Essa é a pista ${m.scanned ?? "?"}; procure a pista ${m.expected} primeiro`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="scan-progress">
          <div className="progress"><span style={{ width: `${outcome.progress.percent}%` }} /></div>
          <p className="muted">
            {outcome.progress.next === null
              ? "Você está no nível máximo: Diamante."
              : `Faltam ${outcome.progress.missing.toLocaleString("pt-BR")} pts para o nível ${TIER_LABEL[outcome.progress.next]}.`}
          </p>
        </div>

        <a className="btn btn-block" href="/app">
          Ver minhas missões <ArrowRight size={18} aria-hidden />
        </a>
      </section>
    </VisitorShell>
  );
}
