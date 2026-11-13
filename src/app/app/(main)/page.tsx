import Link from "next/link";
import { isMissionActive } from "@/domain/game";
import { TIERS, TIER_THRESHOLDS, requirementLabel, tierFromPoints, type Tier } from "@/domain/schemas";
import { formatTime } from "@/domain/time";
import { checkRedeem } from "@/domain/rewards";
import { missionCards, visitorStreak } from "@/server/services";
import { requireVisitor } from "@/server/visitor";
import { Countdown } from "@/ui/components/Countdown";
import { ProgressBar } from "@/ui/components/ProgressBar";
import { MISSION_ICONS, TIER_LABELS, TIER_NAMES, formatPoints, initials } from "@/ui/labels";

const nextTier = (tier: Tier): Tier | null => TIERS[TIERS.indexOf(tier) + 1] ?? null;

export default async function HomePage() {
  const { db, user, now } = await requireVisitor();
  const tier = tierFromPoints(user.lifetimePoints);
  const upcoming = nextTier(tier);
  const streak = visitorStreak(db, user.id, now);
  const cards = missionCards(db, user.id, now);
  const flash = cards.filter(
    (c) => c.mission.launch.type === "flash" && isMissionActive(c.mission, now) && c.progress.status !== "completed",
  );
  const featured = cards.filter(
    (c) => c.mission.launch.type === "scheduled" && (c.progress.status === "available" || c.progress.status === "in_progress"),
  );
  const affordable = db.rewards.filter((r) => checkRedeem(r, user) === null).slice(0, 2);
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <>
      <header className="app-header">
        <h1>Olá, {firstName} 👋</h1>
        <Link className="avatar" href="/app/perfil" aria-label="Meu perfil">
          {initials(user.name)}
        </Link>
      </header>

      <section className="card tier-card stack" aria-label="Seus pontos">
        <div className="row between">
          <span className="chip">{TIER_LABELS[tier]}</span>
          <span className="points">{formatPoints(user.points)} pts</span>
        </div>
        {upcoming === null ? (
          <p className="muted small">Você está no nível máximo. Brilhou! 💎</p>
        ) : (
          <>
            <ProgressBar
              value={user.lifetimePoints - TIER_THRESHOLDS[tier]}
              max={TIER_THRESHOLDS[upcoming] - TIER_THRESHOLDS[tier]}
              label={`Progresso até o nível ${TIER_NAMES[upcoming]}`}
            />
            <p className="muted small">
              Faltam {formatPoints(TIER_THRESHOLDS[upcoming] - user.lifetimePoints)} pontos para {TIER_NAMES[upcoming]}
            </p>
          </>
        )}
      </section>

      <section className="card row" style={{ marginTop: 12 }} aria-label="Presença">
        {user.presence.status === "at_mall" ? (
          <>
            <span aria-hidden="true">📍</span>
            <div>
              <p style={{ fontWeight: 700 }}>Você está no shopping</p>
              <p className="muted small">
                Check-in {formatTime(user.presence.checkedInAt)} · {user.presence.entrance}
              </p>
            </div>
          </>
        ) : (
          <>
            <span aria-hidden="true">🚪</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700 }}>Chegou no shopping?</p>
              <p className="muted small">Escaneie o QR da entrada para fazer check-in.</p>
            </div>
            <Link className="btn" href="/app/scanner" style={{ padding: "0 14px" }}>
              Check-in
            </Link>
          </>
        )}
      </section>

      <p style={{ margin: "12px 0 0", fontWeight: 600 }}>
        🔥 Sequência: {streak} {streak === 1 ? "dia" : "dias"}
      </p>

      {flash.map(({ mission, points }) => (
        <Link key={mission.id} href={`/app/relampago/${mission.id}`} className="flash-card rise" style={{ marginTop: 20 }}>
          <div className="row between">
            <strong>⚡ MISSÃO RELÂMPAGO</strong>
            <span>
              ⏱ <Countdown endsAt={mission.endsAt.toISOString()} initialNow={now.toISOString()} />
            </span>
          </div>
          <p style={{ margin: "8px 0", fontSize: "1.125rem", fontWeight: 700 }}>{requirementLabel(mission.requirement)}</p>
          <p style={{ margin: "0 0 12px" }}>
            🏷 {formatPoints(mission.pointsReward)} pts ×{" "}
            {mission.launch.type === "flash" ? mission.launch.pointsMultiplier : 1} ={" "}
            <strong>{formatPoints(points)} pts</strong>
          </p>
          <span className="btn btn-block">📷 Escanear meu cupom</span>
        </Link>
      ))}

      <div className="row between">
        <h2>Missões em destaque</h2>
        <Link href="/app/missoes">Ver todas</Link>
      </div>
      {featured.length === 0 ? (
        <p className="muted">Você completou tudo por aqui. Novas missões chegam toda semana!</p>
      ) : (
        <div className="scroller">
          {featured.map(({ mission, progress, points }) => (
            <Link key={mission.id} href="/app/missoes" className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
              <p style={{ fontWeight: 700 }}>
                <span aria-hidden="true">{MISSION_ICONS[mission.requirement.kind]}</span> {mission.title}
              </p>
              {progress.status === "in_progress" ? (
                <>
                  <ProgressBar value={progress.current} max={progress.target} label={`Progresso em ${mission.title}`} />
                  <p className="small">
                    {progress.current}/{progress.target} · <span className="pts">+{formatPoints(points)}</span>
                  </p>
                </>
              ) : (
                <p className="small">
                  Disponível · <span className="pts">+{formatPoints(points)}</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {affordable.length > 0 && (
        <>
          <h2>Já pode resgatar 🎁</h2>
          <div className="stack">
            {affordable.map((reward) => (
              <Link key={reward.id} href="/app/premios" className="card row between" style={{ color: "inherit", textDecoration: "none" }}>
                <span style={{ fontWeight: 600 }}>{reward.title}</span>
                <span className="pts">{formatPoints(reward.costPoints)} pts</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
