import Link from "next/link";
import { benefitLabel } from "@/domain/schemas";
import { checkRedeem } from "@/domain/rewards";
import { requireVisitor } from "@/server/visitor";
import { TIER_NAMES, formatPoints } from "@/ui/labels";
import { RedeemButton } from "./RedeemButton";

const ICONS = { free_parking: "🅿️", discount_percent: "🏷️", discount_fixed: "💸", gift: "🎁" } as const;

export default async function RewardsPage() {
  const { db, user } = await requireVisitor();
  const rewards = db.rewards.filter((r) => r.active).sort((a, b) => a.costPoints - b.costPoints);
  const mine = db.redemptions.filter((r) => r.userId === user.id && r.status === "reserved");

  return (
    <>
      <header className="app-header">
        <h1>Prêmios</h1>
        <span className="chip">Saldo: {formatPoints(user.points)} pts</span>
      </header>

      {mine.length > 0 && (
        <section className="stack" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>Seus cupons</h2>
          {mine.map((r) => {
            const reward = db.rewards.find((rw) => rw.id === r.rewardId);
            return (
              <Link key={r.id} href={`/app/cupom/${r.id}`} className="card row between" style={{ color: "inherit", textDecoration: "none" }}>
                <span style={{ fontWeight: 600 }}>{reward?.title ?? "Recompensa"}</span>
                <span className="chip">Mostrar código</span>
              </Link>
            );
          })}
        </section>
      )}

      <div className="stack">
        {rewards.map((reward) => {
          const problem = checkRedeem(reward, user);
          const locked = problem === "tier_locked";
          return (
            <article key={reward.id} className={`card stack${locked ? " locked" : ""}`}>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontWeight: 700 }}>
                    <span aria-hidden="true">{locked ? "🔒" : ICONS[reward.benefit.kind]}</span> {reward.title}
                  </p>
                  <p className="muted small">{benefitLabel(reward.benefit)}</p>
                </div>
                <span className="pts">{formatPoints(reward.costPoints)} pts</span>
              </div>
              <div className="row between small">
                <span className="muted">
                  {locked
                    ? `Exclusivo para nível ${TIER_NAMES[reward.minTier]}`
                    : reward.stock === null
                      ? "Sem limite"
                      : `${reward.stock} restantes`}
                </span>
                <RedeemButton rewardId={reward.id} problem={problem} />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
