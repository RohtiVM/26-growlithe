import Link from "next/link";
import { progressLabel, requirementLabel, type MissionStatus } from "@/domain/schemas";
import { missionCards } from "@/server/services";
import { requireVisitor } from "@/server/visitor";
import { ProgressBar } from "@/ui/components/ProgressBar";
import { MISSION_ICONS, formatPoints } from "@/ui/labels";

const FILTERS = {
  ativas: { label: "Ativas", statuses: ["available", "in_progress"] },
  concluidas: { label: "Concluídas", statuses: ["completed"] },
  expiradas: { label: "Expiradas", statuses: ["expired"] },
} as const satisfies Record<string, { label: string; statuses: readonly MissionStatus[] }>;
type FilterKey = keyof typeof FILTERS;

const isFilter = (v: unknown): v is FilterKey => typeof v === "string" && v in FILTERS;

const daysLeft = (end: Date, now: Date): string => {
  const hours = Math.ceil((end.getTime() - now.getTime()) / 3_600_000);
  if (hours <= 24) return `termina em ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `termina em ${days} dias`;
};

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, user, now } = await requireVisitor();
  const raw = (await searchParams).f;
  const filter: FilterKey = isFilter(raw) ? raw : "ativas";
  const statuses: readonly MissionStatus[] = FILTERS[filter].statuses;
  const cards = missionCards(db, user.id, now).filter((c) => statuses.includes(c.progress.status));

  return (
    <>
      <header className="app-header">
        <h1>Missões</h1>
      </header>
      <nav className="tabs" aria-label="Filtrar missões">
        {Object.entries(FILTERS).map(([key, { label }]) => (
          <Link key={key} href={`/app/missoes?f=${key}`} aria-current={key === filter ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {cards.length === 0 && (
        <p className="muted">
          {filter === "ativas"
            ? "Nenhuma missão ativa agora. Volte amanhã para ver as novidades!"
            : filter === "concluidas"
              ? "Você ainda não concluiu missões. Que tal começar pela caça ao tesouro?"
              : "Nenhuma missão expirada."}
        </p>
      )}

      <div className="stack">
        {cards.map(({ mission, progress, points }) => {
          const isFlash = mission.launch.type === "flash";
          const body = (
            <>
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <p style={{ fontWeight: 700 }}>
                  <span aria-hidden="true">{MISSION_ICONS[mission.requirement.kind]}</span> {mission.title}
                </p>
                <span className="pts">+{formatPoints(points)}</span>
              </div>
              <p className="muted small">{requirementLabel(mission.requirement)}</p>
              {progress.status === "in_progress" && (
                <ProgressBar value={progress.current} max={progress.target} label={`Progresso em ${mission.title}`} />
              )}
              <div className="row between small">
                <span className="chip">{progressLabel(progress)}</span>
                {(progress.status === "available" || progress.status === "in_progress") && (
                  <span className="muted">{daysLeft(mission.endsAt, now)}</span>
                )}
              </div>
            </>
          );
          return isFlash && progress.status === "available" ? (
            <Link key={mission.id} href={`/app/relampago/${mission.id}`} className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
              {body}
            </Link>
          ) : (
            <article key={mission.id} className="card stack">
              {body}
            </article>
          );
        })}
      </div>
    </>
  );
}
