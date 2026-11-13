/** Regras puras de resgate de recompensas. */
import {
  TIERS,
  tierFromPoints,
  type RedeemError,
  type Redemption,
  type Reward,
  type Tier,
  type ValidateError,
} from "./schemas";

/** Quanto tempo o visitante tem para mostrar o código no caixa. */
export const REDEMPTION_TTL_MS = 24 * 60 * 60 * 1000;

export const tierRank = (tier: Tier): number => TIERS.indexOf(tier);

export const checkRedeem = (
  reward: Reward | undefined,
  user: { points: number; lifetimePoints: number },
): RedeemError | null => {
  if (reward?.active !== true) return "reward_unavailable";
  if (tierRank(tierFromPoints(user.lifetimePoints)) < tierRank(reward.minTier)) return "tier_locked";
  if (reward.stock !== null && reward.stock <= 0) return "out_of_stock";
  if (user.points < reward.costPoints) return "insufficient_points";
  return null;
};

/** Código de 6 dígitos que não colide com nenhum código reservado. `random` é injetável. */
export const generateRedemptionCode = (
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): string => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(random() * 1_000_000)).padStart(6, "0");
    if (!taken.has(code)) return code;
  }
  throw new Error("Não foi possível gerar um código livre");
};

export const checkValidate = (
  redemption: Redemption | undefined,
  now: Date,
): ValidateError | null => {
  if (redemption === undefined) return "code_not_found";
  switch (redemption.status) {
    case "redeemed":
      return "code_already_used";
    case "expired":
      return "code_expired";
    case "reserved":
      return redemption.expiresAt < now ? "code_expired" : null;
  }
};
