/**
 * Regras puras do app do visitante (spec 004). O servidor chama o banco e
 * entrega a resposta crua; estas funções decidem o que a tela mostra.
 */
import {
  SCAN_ERROR_MESSAGES,
  ScanCheckpointRow,
  TIERS,
  TIER_THRESHOLDS,
  tierFromPoints,
  type ScanError,
  type ScanMissionRow,
  type Tier,
} from "@/domain/schemas";

export { VisitorNameInput } from "@/domain/schemas";

export type TierProgress = { tier: Tier; next: Tier | null; missing: number; percent: number };

/** Nível atual, próximo nível e quanto falta (barra de progresso da Home). */
export const tierProgress = (lifetimePoints: number): TierProgress => {
  const tier = tierFromPoints(lifetimePoints);
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  if (next === null) return { tier, next: null, missing: 0, percent: 100 };
  const floor = TIER_THRESHOLDS[tier];
  const ceil = TIER_THRESHOLDS[next];
  return {
    tier,
    next,
    missing: ceil - lifetimePoints,
    percent: Math.floor(((lifetimePoints - floor) / (ceil - floor)) * 100),
  };
};

export type VisitorScanOutcome =
  | {
      kind: "success";
      checkpoint: string;
      isCheckin: boolean;
      basePoints: number;
      pointsEarned: number;
      balance: number;
      lifetimePoints: number;
      /** Preenchido só quando este scan cruzou um limiar (D15). */
      tierUp: Tier | null;
      progress: TierProgress;
      missions: ScanMissionRow[];
    }
  | { kind: "error"; error: ScanError; message: string };

const fail = (error: ScanError): VisitorScanOutcome => ({ kind: "error", error, message: SCAN_ERROR_MESSAGES[error] });

/** Resposta do banco → o que a tela mostra. Qualquer coisa estranha vira `invalid_qr`. */
export const scanOutcomeFromRow = (raw: unknown): VisitorScanOutcome => {
  const parsed = ScanCheckpointRow.safeParse(raw);
  if (!parsed.success) return fail("invalid_qr");
  const row = parsed.data;
  switch (row.result) {
    case "ok": {
      const before = tierFromPoints(row.lifetime_before);
      const after = tierFromPoints(row.lifetime_after);
      return {
        kind: "success",
        checkpoint: row.checkpoint,
        isCheckin: row.is_checkin,
        basePoints: row.base_points,
        pointsEarned: row.points_earned,
        balance: row.points_balance,
        lifetimePoints: row.lifetime_after,
        tierUp: after === before ? null : after,
        progress: tierProgress(row.lifetime_after),
        missions: row.missions,
      };
    }
    case "already_scanned_today":
    case "invalid_qr":
    case "expired_qr":
    case "not_authenticated":
      return fail(row.result);
    default:
      return fail("invalid_qr");
  }
};

export const TIER_LABEL = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
} as const satisfies Record<Tier, string>;
