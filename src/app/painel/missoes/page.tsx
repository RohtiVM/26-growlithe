import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  PartyPopper,
  Plus,
  QrCode,
  ShoppingBag,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import {
  MISSION_PERIODS,
  MISSION_PERIOD_LABELS,
  MissionRow,
  assertNever,
  groupMissionsByPeriod,
  requirementLabel,
  type Mission,
  type MissionKind,
  type MissionPeriod,
} from "@/domain/schemas";
import { requireStaffRole } from "@/painel/access";
import { formatMissionPeriod } from "@/painel/missions";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../no-access";
import { PainelHeader } from "../painel-header";
import { EndMissionButton } from "./end-mission-button";
import styles from "./missoes.module.css";

export const metadata: Metadata = { title: "Missões · Painel Growlithe" };

const KIND_ICON = {
  qr_scan: QrCode,
  visit_streak: CalendarCheck,
  purchase: ShoppingBag,
  purchase_category: ShoppingBag,
  event_checkin: PartyPopper,
} as const satisfies Record<MissionKind, LucideIcon>;

const EMPTY_TEXT = {
  active: "Nenhuma missão valendo agora.",
  upcoming: "Nenhuma missão agendada.",
  ended: "Nenhuma missão encerrada ainda.",
} as const satisfies Record<MissionPeriod, string>;

/** Pontos e, se for Missão Relâmpago, o multiplicador. */
function Points({ mission }: { mission: Mission }) {
  switch (mission.launch.type) {
    case "scheduled":
      return <span className="tabular">{mission.pointsReward} pts</span>;
    case "flash":
      return (
        <>
          <span className="tabular">{mission.pointsReward} pts</span>
          <span className={styles.flash}>
            <Zap size={14} aria-hidden /> Relâmpago ×{mission.launch.pointsMultiplier}
          </span>
        </>
      );
    default:
      return assertNever(mission.launch);
  }
}

export default async function MissoesPage({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return <NoAccess />;

  const created = (await searchParams).criada === "1";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, requirement, points_reward, starts_at, ends_at, max_completions_per_user, store_id, launch, created_at",
    )
    .order("starts_at", { ascending: false });

  // Borda do banco: linha que não bate com o schema não entra na tela.
  const missions = z
    .array(z.unknown())
    .catch([])
    .parse(data)
    .flatMap((row) => {
      const parsed = MissionRow.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  const groups = groupMissionsByPeriod(missions, new Date());

  return (
    <>
      <PainelHeader staff={allowed.data} />
      <main className="container painel-main">
        <a className="back-link" href="/painel">
          <ArrowLeft size={16} aria-hidden /> Painel
        </a>
        <div className="painel-title reveal reveal-1">
          <h1>Missões</h1>
          <p className="lead">Desafios que dão pontos. Agende missões da semana ou lance uma Missão Relâmpago.</p>
        </div>

        <div className="reveal reveal-2" style={{ marginBottom: 24 }}>
          <a className="btn" href="/painel/missoes/nova">
            <Plus size={18} aria-hidden /> Nova missão
          </a>
        </div>

        {created && (
          <p className="alert" role="status" style={{ marginBottom: 24 }}>
            <CheckCircle2 size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
            Missão criada. Ela aparece no app do visitante dentro do período.
          </p>
        )}
        {error !== null && (
          <p className="alert" role="alert" style={{ marginBottom: 24 }}>
            Não conseguimos carregar as missões. Recarregue a página.
          </p>
        )}

        <div className={`${styles.period ?? ""} reveal reveal-3`}>
          {MISSION_PERIODS.map((period) => (
            <section key={period} aria-labelledby={`grupo-${period}`}>
              <div className="section-head" style={{ marginBottom: 16 }}>
                <h2 id={`grupo-${period}`} style={{ fontSize: "1.25rem" }}>
                  {MISSION_PERIOD_LABELS[period]}
                </h2>
                <span className="muted tabular">{groups[period].length}</span>
              </div>
              {groups[period].length === 0 ? (
                <div className="empty">
                  <Target size={28} aria-hidden />
                  <span>{EMPTY_TEXT[period]}</span>
                </div>
              ) : (
                <ul className="list">
                  {groups[period].map((m) => {
                    const Icon = KIND_ICON[m.requirement.kind];
                    return (
                      <li key={m.id} className="card list-item">
                        <div className="list-item-main">
                          <span className="icon-tile">
                            <Icon size={20} aria-hidden />
                          </span>
                          <div>
                            <strong>{m.title}</strong>
                            <p className="muted">{requirementLabel(m.requirement)}</p>
                            <p className={`muted ${styles.meta ?? ""}`}>
                              <Points mission={m} />
                              <span>{formatMissionPeriod(m)}</span>
                            </p>
                          </div>
                        </div>
                        {period === "active" && <EndMissionButton missionId={m.id} title={m.title} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
