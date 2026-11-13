/**
 * Casos de uso do Growlithe. Recebem o banco e o relógio por parâmetro,
 * então os testes rodam com dados e horário controlados.
 *
 * Regra de atomicidade: a parte que lê e grava o banco nunca tem `await`
 * no meio. Trabalho assíncrono (SEFAZ, hash) acontece ANTES.
 */
import {
  effectivePoints,
  emptyProgress,
  evaluateScan,
  isMissionActive,
  nextHint,
  pointsMultiplier,
  progressView,
  type ProgressRecord,
} from "@/domain/game";
import {
  REDEMPTION_TTL_MS,
  checkRedeem,
  checkValidate,
  generateRedemptionCode,
} from "@/domain/rewards";
import {
  Checkpoint,
  CheckpointId,
  LandingLead,
  Mission,
  MissionId,
  RECEIPT_ERROR_MESSAGES,
  REDEEM_ERROR_MESSAGES,
  RedemptionId,
  SCAN_ERROR_MESSAGES,
  User,
  UserId,
  VALIDATE_ERROR_MESSAGES,
  benefitLabel,
  tierFromPoints,
  type CreateCheckpointInput,
  type CreateMissionInput,
  type JoinWaitlistInput,
  type MissionProgress,
  type ReceiptError,
  type ReceiptSuccess,
  type RedeemError,
  type Redemption,
  type Result,
  type ScanError,
  type ScanResult,
  type Tier,
  type Utm,
  type ValidateError,
  type ValidateSuccess,
} from "@/domain/schemas";
import { currentStreak, isMallOpen, localDay } from "@/domain/time";
import type { Variant } from "@/landing/ab-test";
import { sha256 } from "./crypto";
import type { Db, LedgerReason } from "./db";
import { checkReceiptForMission, type ReceiptVerifier } from "./receipt-verifier";

export const MALL_HOURS = { open: 10, close: 22 } as const;

const fail = <TError extends string>(error: TError, message: string) =>
  ({ ok: false, error, message }) as const;

const findUser = (db: Db, userId: UserId) =>
  db.users.find((u) => u.id === userId && u.deletedAt === null);

const visitDaysOf = (db: Db, userId: UserId): string[] => [
  ...new Set(db.scans.filter((s) => s.userId === userId).map((s) => s.day)),
];

/** Único lugar que muda saldo. Ganho soma nos pontos históricos; gasto e estorno não. */
const credit = (
  db: Db,
  user: User,
  delta: number,
  reason: LedgerReason,
  refId: string,
  now: Date,
): void => {
  if (delta === 0) return;
  user.points += delta;
  if (delta > 0 && reason !== "redemption_refund") user.lifetimePoints += delta;
  db.ledger.push({ userId: user.id, delta, reason, refId, at: now });
};

const upsertProgress = (db: Db, rec: ProgressRecord): void => {
  const i = db.progress.findIndex((p) => p.userId === rec.userId && p.missionId === rec.missionId);
  if (i === -1) db.progress.push(rec);
  else db.progress[i] = rec;
};

const tierChange = (before: number, after: number): Tier | null => {
  const [b, a] = [tierFromPoints(before), tierFromPoints(after)];
  return a === b ? null : a;
};

/* ------------------------------------------------------------------ */
/* Scan de checkpoint (QR do Growlithe)                                */
/* ------------------------------------------------------------------ */

export const scanCheckpoint = (
  db: Db,
  args: { userId: UserId; checkpointId: CheckpointId; now: Date; enforceMallHours: boolean },
): ScanResult => {
  const { userId, checkpointId, now } = args;
  const err = (e: ScanError) => fail(e, SCAN_ERROR_MESSAGES[e]);

  const user = findUser(db, userId);
  if (user === undefined) return err("not_authenticated");
  const checkpoint = db.checkpoints.find((c) => c.id === checkpointId && c.active);
  if (checkpoint === undefined) return err("invalid_qr");
  if (args.enforceMallHours && !isMallOpen(now, MALL_HOURS)) return err("mall_closed");

  const today = localDay(now);
  // Mesmo papel do UNIQUE (user_id, checkpoint_id, scanned_on) no Postgres.
  if (db.scans.some((s) => s.userId === userId && s.checkpointId === checkpointId && s.day === today)) {
    return err("already_scanned_today");
  }

  const lifetimeBefore = user.lifetimePoints;
  db.scans.push({ userId, checkpointId, day: today, at: now });
  if (checkpoint.kind === "entrance") {
    user.presence = { status: "at_mall", checkedInAt: now, entrance: checkpoint.label };
  }
  credit(db, user, checkpoint.scanPoints, "checkpoint_scan", checkpoint.id, now);

  const visitDays = visitDaysOf(db, userId);
  const userProgress = db.progress.filter((p) => p.userId === userId);
  const { updates, completed } = evaluateScan({
    userId,
    checkpointId,
    now,
    missions: db.missions,
    progress: userProgress,
    visitDays,
  });
  for (const rec of updates) upsertProgress(db, rec);
  for (const { mission, points } of completed) {
    credit(db, user, points, "mission_completed", mission.id, now);
  }

  const touched = updates.flatMap((rec) => {
    const mission = db.missions.find((m) => m.id === rec.missionId);
    return mission === undefined ? [] : [{ mission, rec }];
  });

  return {
    ok: true,
    data: {
      pointsEarned: user.lifetimePoints - lifetimeBefore,
      progress: touched.map(({ mission, rec }) => progressView(mission, rec, { now, visitDays })),
      tierUp: tierChange(lifetimeBefore, user.lifetimePoints),
      checkpointLabel: checkpoint.label,
      completedMissions: completed.map(({ mission, points }) => ({ title: mission.title, points })),
      nextHint:
        touched
          .map(({ mission, rec }) => nextHint(mission, rec, db.checkpoints))
          .find((hint) => hint !== null) ?? null,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Missão Relâmpago: cupom fiscal (NFC-e) — spec 001                   */
/* ------------------------------------------------------------------ */

export const scanReceipt = async (
  db: Db,
  verifier: ReceiptVerifier,
  args: { userId: UserId; missionId: MissionId; qrUrl: string; now: Date },
): Promise<Result<ReceiptSuccess, ReceiptError | "not_authenticated">> => {
  const { userId, missionId, now } = args;
  const err = (e: ReceiptError) => fail(e, RECEIPT_ERROR_MESSAGES[e]);

  if (findUser(db, userId) === undefined) {
    return fail("not_authenticated", SCAN_ERROR_MESSAGES.not_authenticated);
  }
  const preMission = db.missions.find((m) => m.id === missionId);
  if (preMission?.requirement.kind !== "purchase_category" || !isMissionActive(preMission, now)) {
    return err("mission_not_active");
  }

  // Assíncrono primeiro (rede e hash), fora da seção atômica.
  const verified = await verifier.verify(args.qrUrl);
  if (!verified.ok) return err("invalid_receipt");
  const receipt = verified.data;
  const accessKeyHash = await sha256(receipt.key.raw);

  /* ---- seção atômica: sem await daqui para baixo ---- */
  const user = findUser(db, userId);
  const mission = db.missions.find((m) => m.id === missionId);
  if (user === undefined) return fail("not_authenticated", SCAN_ERROR_MESSAGES.not_authenticated);
  if (mission?.requirement.kind !== "purchase_category" || !isMissionActive(mission, now)) {
    return err("mission_not_active");
  }

  const store = db.stores.find((s) => s.cnpj === receipt.key.cnpj && s.active);
  if (store === undefined) return err("store_not_in_mall");
  if (store.category !== mission.requirement.category) return err("wrong_category");

  const check = checkReceiptForMission(receipt, {
    startsAt: mission.startsAt,
    endsAt: mission.endsAt,
    minAmountCents: null,
  });
  if (!check.ok) return err("receipt_outside_window");

  // Mesmo papel do UNIQUE (access_key_hash): o cupom vale uma vez no sistema inteiro.
  if (db.receipts.some((r) => r.accessKeyHash === accessKeyHash)) return err("receipt_already_used");

  const existing = db.progress.find((p) => p.userId === userId && p.missionId === missionId);
  if (existing !== undefined && existing.completions >= mission.maxCompletionsPerUser) {
    return err("mission_already_completed");
  }

  const lifetimeBefore = user.lifetimePoints;
  const points = effectivePoints(mission);
  db.receipts.push({
    accessKeyHash,
    userId,
    storeId: store.id,
    missionId,
    scannedAt: now,
    verifiedBy: receipt.source,
  });
  const rec = existing ?? emptyProgress(userId, missionId, now);
  upsertProgress(db, {
    ...rec,
    completions: rec.completions + 1,
    lastCompletedAt: now,
    pointsAwarded: rec.pointsAwarded + points,
  });
  credit(db, user, points, "receipt", accessKeyHash, now);

  return {
    ok: true,
    data: {
      storeName: store.name,
      category: store.category,
      pointsEarned: points,
      multiplier: pointsMultiplier(mission),
      verifiedBy: receipt.source,
      tierUp: tierChange(lifetimeBefore, user.lifetimePoints),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Recompensas: resgate (visitante) e validação (lojista)              */
/* ------------------------------------------------------------------ */

/** Cupons de resgate vencidos viram "expired" e os pontos voltam. Chamado nas leituras. */
export const expireRedemptions = (db: Db, now: Date): void => {
  db.redemptions = db.redemptions.map((r): Redemption => {
    if (r.status !== "reserved" || r.expiresAt >= now) return r;
    const user = findUser(db, r.userId);
    const reward = db.rewards.find((rw) => rw.id === r.rewardId);
    if (user !== undefined && reward !== undefined) {
      credit(db, user, reward.costPoints, "redemption_refund", r.id, now);
      if (reward.stock !== null) reward.stock += 1;
    }
    return {
      id: r.id,
      userId: r.userId,
      rewardId: r.rewardId,
      createdAt: r.createdAt,
      status: "expired",
      expiredAt: now,
    };
  });
};

export const redeemReward = (
  db: Db,
  args: { userId: UserId; rewardId: string; now: Date },
): Result<{ redemptionId: RedemptionId }, RedeemError | "not_authenticated"> => {
  const { userId, now } = args;
  expireRedemptions(db, now);
  const user = findUser(db, userId);
  if (user === undefined) return fail("not_authenticated", SCAN_ERROR_MESSAGES.not_authenticated);

  const reward = db.rewards.find((r) => r.id === args.rewardId);
  const problem = checkRedeem(reward, user);
  if (problem !== null || reward === undefined) {
    const e = problem ?? "reward_unavailable";
    return fail(e, REDEEM_ERROR_MESSAGES[e]);
  }

  const taken = new Set(
    db.redemptions.flatMap((r) => (r.status === "reserved" ? [r.code] : [])),
  );
  const redemption: Redemption = {
    id: RedemptionId.parse(crypto.randomUUID()),
    userId,
    rewardId: reward.id,
    createdAt: now,
    status: "reserved",
    code: generateRedemptionCode(taken),
    expiresAt: new Date(now.getTime() + REDEMPTION_TTL_MS),
  };
  db.redemptions.push(redemption);
  if (reward.stock !== null) reward.stock -= 1;
  credit(db, user, -reward.costPoints, "redemption", redemption.id, now);

  return { ok: true, data: { redemptionId: redemption.id } };
};

export const validateRedemption = (
  db: Db,
  args: { code: string; now: Date },
): Result<ValidateSuccess, ValidateError> => {
  const { now } = args;
  expireRedemptions(db, now);
  // Um código expirado não tem mais `code`; procuramos entre os que têm.
  const candidates = db.redemptions.filter((r) => r.status !== "expired" && r.code === args.code);
  const target = candidates.find((r) => r.status === "reserved") ?? candidates[0];
  const problem = checkValidate(target, now);
  if (problem !== null || target?.status !== "reserved") {
    const e = problem ?? "code_not_found";
    return fail(e, VALIDATE_ERROR_MESSAGES[e]);
  }

  const reward = db.rewards.find((r) => r.id === target.rewardId);
  const user = findUser(db, target.userId);
  if (reward === undefined || user === undefined) {
    return fail("code_not_found", VALIDATE_ERROR_MESSAGES.code_not_found);
  }

  const storeId = "storeId" in reward.benefit ? reward.benefit.storeId : null;
  db.redemptions = db.redemptions.map(
    (r): Redemption =>
      r.id === target.id
        ? {
            id: target.id,
            userId: target.userId,
            rewardId: target.rewardId,
            createdAt: target.createdAt,
            status: "redeemed",
            code: target.code,
            redeemedAt: now,
            validatedByStoreId: storeId,
          }
        : r,
  );

  return {
    ok: true,
    data: {
      rewardTitle: reward.title,
      benefit: benefitLabel(reward.benefit),
      visitorName: user.name,
      visitorTier: tierFromPoints(user.lifetimePoints),
      redeemedAt: now,
    },
  };
};

/* ------------------------------------------------------------------ */
/* Painel do shopping                                                  */
/* ------------------------------------------------------------------ */

export const createMission = (db: Db, input: CreateMissionInput, now: Date): Mission => {
  const mission = Mission.parse({ ...input, id: MissionId.parse(crypto.randomUUID()), createdAt: now });
  db.missions.push(mission);
  return mission;
};

export const createCheckpoint = (db: Db, input: CreateCheckpointInput): Checkpoint => {
  const checkpoint = Checkpoint.parse({
    ...input,
    id: CheckpointId.parse(crypto.randomUUID()),
    active: true,
  });
  db.checkpoints.push(checkpoint);
  return checkpoint;
};

/* ------------------------------------------------------------------ */
/* Visitante: entrar (MVP sem e-mail) e lista de espera                */
/* ------------------------------------------------------------------ */

export const findOrCreateVisitor = (
  db: Db,
  input: { name: string; email: string },
  now: Date,
): User => {
  const email = input.email.trim().toLowerCase();
  const existing = db.users.find((u) => u.email === email && u.deletedAt === null);
  if (existing !== undefined) return existing;
  const user = User.parse({
    id: UserId.parse(crypto.randomUUID()),
    name: input.name.trim(),
    email,
    phone: null,
    points: 0,
    lifetimePoints: 0,
    presence: { status: "away", lastVisitAt: null },
    marketingOptIn: false,
    pushToken: null,
    createdAt: now,
    deletedAt: null,
  });
  db.users.push(user);
  return user;
};

export const joinWaitlist = (
  db: Db,
  input: JoinWaitlistInput,
  ctx: { variant: Variant; utm: Utm; now: Date },
): Result<{ position: number }, "already_on_list"> => {
  const email = input.email.trim().toLowerCase();
  if (db.leads.some((l) => l.email === email)) {
    return fail("already_on_list", "Esse e-mail já está na lista. A gente avisa você!");
  }
  const lead = LandingLead.parse({
    ...input,
    email,
    company: input.profile === "visitante" ? null : input.company,
    id: crypto.randomUUID(),
    variant: ctx.variant,
    utm: ctx.utm,
    createdAt: ctx.now,
  });
  db.leads.push(lead);
  return { ok: true, data: { position: db.leads.length } };
};

/* ------------------------------------------------------------------ */
/* Leituras para as telas                                              */
/* ------------------------------------------------------------------ */

export type MissionCard = {
  mission: Mission;
  progress: MissionProgress;
  points: number;
};

export const missionCards = (db: Db, userId: UserId, now: Date): MissionCard[] => {
  const visitDays = visitDaysOf(db, userId);
  return db.missions
    .filter((m) => m.startsAt <= now)
    .map((mission) => {
      const rec = db.progress.find((p) => p.userId === userId && p.missionId === mission.id);
      const progress = progressView(mission, rec, { now, visitDays });
      return { mission, progress, points: effectivePoints(mission) };
    })
    .sort((a, b) => b.mission.createdAt.getTime() - a.mission.createdAt.getTime());
};

export const visitorStreak = (db: Db, userId: UserId, now: Date): number =>
  currentStreak(visitDaysOf(db, userId), localDay(now));

export const adminMetrics = (db: Db, now: Date) => {
  const today = localDay(now);
  const scansToday = db.scans.filter((s) => s.day === today);
  const byCheckpoint = db.checkpoints
    .map((cp) => ({
      checkpoint: cp,
      total: db.scans.filter((s) => s.checkpointId === cp.id).length,
      today: scansToday.filter((s) => s.checkpointId === cp.id).length,
    }))
    .sort((a, b) => b.total - a.total);
  const returning = db.users.filter((u) => new Set(visitDaysOf(db, u.id)).size >= 2).length;
  const leadsByVariant = (v: Variant) => db.leads.filter((l) => l.variant === v).length;

  return {
    visitors: db.users.length,
    returning,
    visitorsToday: new Set(scansToday.map((s) => s.userId)).size,
    scansToday: scansToday.length,
    pointsIssued: db.ledger.filter((e) => e.delta > 0 && e.reason !== "redemption_refund").reduce((sum, e) => sum + e.delta, 0),
    receipts: db.receipts.length,
    redemptions: {
      reserved: db.redemptions.filter((r) => r.status === "reserved").length,
      redeemed: db.redemptions.filter((r) => r.status === "redeemed").length,
    },
    byCheckpoint,
    leads: {
      total: db.leads.length,
      A: leadsByVariant("A"),
      B: leadsByVariant("B"),
      byProfile: {
        visitante: db.leads.filter((l) => l.profile === "visitante").length,
        lojista: db.leads.filter((l) => l.profile === "lojista").length,
        shopping: db.leads.filter((l) => l.profile === "shopping").length,
      },
      bySource: Object.entries(
        db.leads.reduce<Record<string, number>>((acc, l) => {
          const key = l.utm.source ?? "direto";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    },
  };
};
