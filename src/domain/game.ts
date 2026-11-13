/**
 * Motor de gamificação — regras puras, sem banco e sem relógio global.
 *
 * Quem chama (o repositório) busca os dados, chama estas funções e grava o
 * resultado numa única transação. Assim a regra é testável em milissegundos
 * e idêntica em qualquer adaptador de banco.
 */
import {
  assertNever,
  type Checkpoint,
  type CheckpointId,
  type Mission,
  type MissionId,
  type MissionProgress,
  type UserId,
} from "./schemas";
import { currentStreak, localDay } from "./time";

/** Progresso como fica guardado (mais rico que o `MissionProgress` exibido). */
export type ProgressRecord = {
  userId: UserId;
  missionId: MissionId;
  /** Caça ao tesouro: pontos já encontrados na rodada atual. */
  found: CheckpointId[];
  startedAt: Date;
  completions: number;
  lastCompletedAt: Date | null;
  pointsAwarded: number;
};

export const emptyProgress = (userId: UserId, missionId: MissionId, now: Date): ProgressRecord => ({
  userId,
  missionId,
  found: [],
  startedAt: now,
  completions: 0,
  lastCompletedAt: null,
  pointsAwarded: 0,
});

/** Pontos da missão já com o multiplicador da Missão Relâmpago. */
export const effectivePoints = (mission: Mission): number =>
  mission.pointsReward * pointsMultiplier(mission);

export const pointsMultiplier = (mission: Mission): number =>
  mission.launch.type === "flash" ? mission.launch.pointsMultiplier : 1;

export const isMissionActive = (mission: Mission, now: Date): boolean =>
  now >= mission.startsAt && now <= mission.endsAt;

export const missionTarget = (mission: Mission): number => {
  const r = mission.requirement;
  switch (r.kind) {
    case "qr_scan":
      return r.checkpointIds.length;
    case "visit_streak":
      return r.days;
    case "purchase":
    case "purchase_category":
    case "event_checkin":
      return 1;
    default:
      return assertNever(r);
  }
};

const isExhausted = (mission: Mission, rec: ProgressRecord | undefined): boolean =>
  rec !== undefined && rec.completions >= mission.maxCompletionsPerUser;

/* ------------------------------------------------------------------ */
/* Scan de checkpoint → progresso das missões                          */
/* ------------------------------------------------------------------ */

export type ScanEvaluation = {
  updates: ProgressRecord[];
  completed: Array<{ mission: Mission; points: number }>;
};

/**
 * Aplica um scan JÁ ACEITO (assinatura ok, não repetido hoje) às missões ativas.
 * `visitDays` deve incluir o dia de hoje.
 */
export const evaluateScan = (args: {
  userId: UserId;
  checkpointId: CheckpointId;
  now: Date;
  missions: readonly Mission[];
  progress: readonly ProgressRecord[];
  visitDays: readonly string[];
}): ScanEvaluation => {
  const { userId, checkpointId, now } = args;
  const today = localDay(now);
  const updates: ProgressRecord[] = [];
  const completed: ScanEvaluation["completed"] = [];

  for (const mission of args.missions) {
    if (!isMissionActive(mission, now)) continue;
    const existing = args.progress.find((p) => p.missionId === mission.id);
    if (isExhausted(mission, existing)) continue;

    const rec = existing ?? emptyProgress(userId, mission.id, now);
    const complete = (base: ProgressRecord): ProgressRecord => {
      const points = effectivePoints(mission);
      completed.push({ mission, points });
      return {
        ...base,
        found: [],
        completions: base.completions + 1,
        lastCompletedAt: now,
        pointsAwarded: base.pointsAwarded + points,
      };
    };
    const completedToday = rec.lastCompletedAt !== null && localDay(rec.lastCompletedAt) === today;

    const r = mission.requirement;
    switch (r.kind) {
      case "qr_scan": {
        if (!r.checkpointIds.includes(checkpointId) || rec.found.includes(checkpointId)) break;
        // Em ordem: só conta se for exatamente o próximo da lista.
        if (r.ordered && r.checkpointIds[rec.found.length] !== checkpointId) break;
        const found = [...rec.found, checkpointId];
        const next = { ...rec, found };
        updates.push(found.length >= r.checkpointIds.length ? complete(next) : next);
        break;
      }
      case "event_checkin": {
        if (r.checkpointId === checkpointId && !completedToday) updates.push(complete(rec));
        break;
      }
      case "visit_streak": {
        if (completedToday) break;
        if (currentStreak(args.visitDays, today) >= r.days) updates.push(complete(rec));
        break;
      }
      case "purchase":
      case "purchase_category":
        // Validadas pelo cupom fiscal, não por scan de checkpoint.
        break;
      default:
        assertNever(r);
    }
  }

  return { updates, completed };
};

/* ------------------------------------------------------------------ */
/* Progresso exibido ao visitante                                     */
/* ------------------------------------------------------------------ */

export const progressView = (
  mission: Mission,
  rec: ProgressRecord | undefined,
  ctx: { now: Date; visitDays: readonly string[] },
): MissionProgress => {
  const missionId = mission.id;
  if (rec !== undefined && isExhausted(mission, rec) && rec.lastCompletedAt !== null) {
    return {
      status: "completed",
      missionId,
      completedAt: rec.lastCompletedAt,
      pointsAwarded: Math.max(rec.pointsAwarded, 1),
    };
  }
  if (ctx.now > mission.endsAt) return { status: "expired", missionId, expiredAt: mission.endsAt };

  const target = missionTarget(mission);
  const startedAt = rec?.startedAt ?? ctx.now;
  const r = mission.requirement;
  switch (r.kind) {
    case "visit_streak": {
      const current = Math.min(currentStreak(ctx.visitDays, localDay(ctx.now)), target);
      return current > 0
        ? { status: "in_progress", missionId, current, target, startedAt }
        : { status: "available", missionId };
    }
    case "qr_scan":
      return rec !== undefined && rec.found.length > 0
        ? { status: "in_progress", missionId, current: rec.found.length, target, startedAt }
        : { status: "available", missionId };
    case "purchase":
    case "purchase_category":
    case "event_checkin":
      return { status: "available", missionId };
    default:
      return assertNever(r);
  }
};

/** Pista do próximo QR da caça ao tesouro (só para missões em ordem). */
export const nextHint = (
  mission: Mission,
  rec: ProgressRecord | undefined,
  checkpoints: readonly Checkpoint[],
): string | null => {
  const r = mission.requirement;
  if (r.kind !== "qr_scan" || !r.ordered || isExhausted(mission, rec)) return null;
  const nextId = r.checkpointIds[rec?.found.length ?? 0];
  const next = checkpoints.find((c) => c.id === nextId);
  return next?.hint ?? null;
};
