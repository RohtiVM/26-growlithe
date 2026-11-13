import { effectivePoints, isMissionActive } from "@/domain/game";
import { requirementLabel } from "@/domain/schemas";
import { formatDateTime } from "@/domain/time";
import { requireAdmin } from "@/server/visitor";
import { MISSION_ICONS, formatPoints } from "@/ui/labels";
import { MissionForm } from "./MissionForm";

export default async function AdminMissionsPage() {
  const { db, now } = await requireAdmin();
  const missions = [...db.missions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const completionsOf = (missionId: string) =>
    db.progress.filter((p) => p.missionId === missionId).reduce((sum, p) => sum + p.completions, 0);

  return (
    <div className="two-col">
      <section>
        <h1>Nova missão</h1>
        <MissionForm
          checkpoints={db.checkpoints.filter((c) => c.active).map((c) => ({ id: c.id, label: c.label }))}
          stores={db.stores.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
          nowIso={now.toISOString()}
        />
      </section>
      <section>
        <h1>Missões</h1>
        <div className="stack">
          {missions.map((mission) => (
            <article key={mission.id} className="card stack">
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <strong>
                  <span aria-hidden="true">{MISSION_ICONS[mission.requirement.kind]}</span> {mission.title}
                </strong>
                <span className="pts">+{formatPoints(effectivePoints(mission))}</span>
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {requirementLabel(mission.requirement)}
              </p>
              <div className="row small" style={{ flexWrap: "wrap", gap: 8 }}>
                {mission.launch.type === "flash" && <span className="chip">⚡ Relâmpago ×{mission.launch.pointsMultiplier}</span>}
                <span className="chip">{isMissionActive(mission, now) ? "Ativa" : now < mission.startsAt ? "Agendada" : "Encerrada"}</span>
                <span className="chip">{completionsOf(mission.id)} conclusões</span>
                <span className="muted">
                  {formatDateTime(mission.startsAt)} → {formatDateTime(mission.endsAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
