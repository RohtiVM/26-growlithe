import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { tierFromPoints } from "@/domain/schemas";
import { formatDateTime } from "@/domain/time";
import type { LedgerReason } from "@/server/db";
import { requireVisitor } from "@/server/visitor";
import { TIER_LABELS, formatPoints, initials } from "@/ui/labels";

const REASONS = {
  checkpoint_scan: "QR Code escaneado",
  mission_completed: "Missão concluída",
  receipt: "Compra validada (cupom fiscal)",
  redemption: "Resgate de prêmio",
  redemption_refund: "Estorno de cupom vencido",
} as const satisfies Record<LedgerReason, string>;

export default async function ProfilePage() {
  const { db, user } = await requireVisitor();
  const history = db.ledger.filter((e) => e.userId === user.id).slice(-20).reverse();
  const visits = new Set(db.scans.filter((s) => s.userId === user.id).map((s) => s.day)).size;

  async function leave() {
    "use server";
    await signOut();
    redirect("/app/entrar");
  }

  return (
    <>
      <header className="app-header">
        <h1>Perfil</h1>
        <span className="avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
      </header>

      <section className="card stack">
        <p style={{ fontWeight: 700, fontSize: "1.125rem" }}>{user.name}</p>
        <p className="muted small">{user.email}</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="chip">{TIER_LABELS[tierFromPoints(user.lifetimePoints)]}</span>
          <span className="chip">{formatPoints(user.lifetimePoints)} pontos históricos</span>
          <span className="chip">
            {visits} {visits === 1 ? "visita" : "visitas"}
          </span>
        </div>
      </section>

      <h2>Histórico de pontos</h2>
      {history.length === 0 ? (
        <p className="muted">Seus pontos vão aparecer aqui. Escaneie seu primeiro QR Code!</p>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {history.map((entry, i) => (
            <li key={`${entry.refId}-${i}`} className="card row between">
              <div>
                <p style={{ fontWeight: 600 }}>{REASONS[entry.reason]}</p>
                <p className="muted small">{formatDateTime(entry.at)}</p>
              </div>
              <span className="pts">
                {entry.delta > 0 ? "+" : ""}
                {formatPoints(entry.delta)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small" style={{ marginTop: 24 }}>
        Privacidade (LGPD): do cupom fiscal guardamos só a loja, o valor e o horário. Nunca o CPF.
      </p>
      <form action={leave}>
        <button className="btn btn-ghost btn-block" type="submit">
          Sair da conta
        </button>
      </form>
    </>
  );
}
