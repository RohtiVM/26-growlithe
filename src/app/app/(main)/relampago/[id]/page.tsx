import Link from "next/link";
import { notFound } from "next/navigation";
import { effectivePoints, isMissionActive } from "@/domain/game";
import { requirementLabel } from "@/domain/schemas";
import { missionCards } from "@/server/services";
import { requireVisitor } from "@/server/visitor";
import { Countdown } from "@/ui/components/Countdown";
import { CATEGORY_NAMES, formatPoints } from "@/ui/labels";
import { ReceiptFlow } from "./ReceiptFlow";

export default async function FlashMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user, now } = await requireVisitor();
  const card = missionCards(db, user.id, now).find((c) => c.mission.id === id);
  if (card === undefined) notFound();
  const { mission, progress } = card;
  const requirement = mission.requirement;
  if (requirement.kind !== "purchase_category") notFound();
  const category = requirement.category;
  const stores = db.stores.filter((s) => s.active && s.category === category);
  const multiplier = mission.launch.type === "flash" ? mission.launch.pointsMultiplier : 1;
  const active = isMissionActive(mission, now);

  return (
    <>
      <Link href="/app" className="small">
        ← Voltar
      </Link>
      <section className="flash-card" style={{ marginTop: 12 }}>
        <div className="row between">
          <strong>⚡ MISSÃO RELÂMPAGO</strong>
          <span>
            ⏱ <Countdown endsAt={mission.endsAt.toISOString()} initialNow={now.toISOString()} />
          </span>
        </div>
        <p style={{ margin: "10px 0", fontSize: "1.25rem", fontWeight: 800 }}>{requirementLabel(mission.requirement)}</p>
        <p style={{ margin: 0 }}>
          🏷 +{formatPoints(mission.pointsReward)} pts ×{multiplier} = <strong>{formatPoints(effectivePoints(mission))} pts</strong>
        </p>
      </section>

      <h2>Como funciona</h2>
      <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
        <li>Compre em qualquer loja de {CATEGORY_NAMES[category].toLowerCase()} do shopping.</li>
        <li>Escaneie o QR Code impresso no rodapé do seu cupom fiscal.</li>
        <li>Pronto: os pontos caem na hora.</li>
      </ol>

      <div style={{ marginTop: 20 }}>
        {/* Sempre montado: depois do scan a página revalida e o resultado não pode sumir. */}
        {progress.status === "completed" || active ? (
          <ReceiptFlow missionId={mission.id} completed={progress.status === "completed"} />
        ) : (
          <div className="alert" role="status">
            <span aria-hidden="true">⌛</span>
            <span>Essa missão já terminou. Fique de olho na próxima!</span>
          </div>
        )}
      </div>

      <h2>Lojas que valem</h2>
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {stores.map((store) => (
          <li key={store.id} className="card">
            {store.name}
          </li>
        ))}
      </ul>
    </>
  );
}
