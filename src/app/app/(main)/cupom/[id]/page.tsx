import Link from "next/link";
import { notFound } from "next/navigation";
import { benefitLabel } from "@/domain/schemas";
import { formatDateTime, formatTime } from "@/domain/time";
import { requireVisitor } from "@/server/visitor";
import { AutoRefresh } from "@/ui/components/AutoRefresh";

export default async function RedemptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireVisitor();
  const redemption = db.redemptions.find((r) => r.id === id && r.userId === user.id);
  const reward = db.rewards.find((r) => r.id === redemption?.rewardId);
  if (redemption === undefined || reward === undefined) notFound();

  return (
    <section className="result" aria-live="polite">
      <p style={{ fontWeight: 700, fontSize: "1.125rem", margin: 0 }}>{reward.title}</p>
      <p className="muted" style={{ marginTop: 4 }}>
        {benefitLabel(reward.benefit)}
      </p>

      {redemption.status === "reserved" && (
        <>
          <AutoRefresh everyMs={4000} />
          <div className="code pop" aria-label={`Código ${redemption.code.split("").join(" ")}`}>
            {redemption.code.split("").map((digit, i) => (
              <span key={i}>{digit}</span>
            ))}
          </div>
          <p style={{ fontWeight: 700 }}>Mostre este código no caixa</p>
          <p className="muted small">Válido até {formatDateTime(redemption.expiresAt)}</p>
          <p className="muted small">Esta tela muda sozinha para “Usado” quando a loja validar.</p>
        </>
      )}

      {redemption.status === "redeemed" && (
        <div className="pop" style={{ margin: "28px 0" }}>
          <div className="emoji" aria-hidden="true">
            ✅
          </div>
          <p style={{ fontWeight: 800, fontSize: "1.5rem", margin: "8px 0" }}>Usado</p>
          <p className="muted">Validado às {formatTime(redemption.redeemedAt)}. Aproveite!</p>
        </div>
      )}

      {redemption.status === "expired" && (
        <div style={{ margin: "28px 0" }}>
          <div className="emoji" aria-hidden="true">
            ⌛
          </div>
          <p style={{ fontWeight: 700 }}>Esse código expirou</p>
          <p className="muted">Os pontos voltaram para o seu saldo. Você pode resgatar de novo.</p>
        </div>
      )}

      <Link className="btn btn-ghost btn-block" href="/app/premios" style={{ marginTop: 16 }}>
        Ver prêmios
      </Link>
    </section>
  );
}
