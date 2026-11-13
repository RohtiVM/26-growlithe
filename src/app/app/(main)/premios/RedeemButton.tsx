"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { redeemReward } from "@/app/actions";
import { REDEEM_ERROR_MESSAGES, type RedeemError } from "@/domain/schemas";

const SHORT = {
  reward_unavailable: "Indisponível",
  insufficient_points: "Faltam pontos",
  tier_locked: "Bloqueado",
  out_of_stock: "Esgotado",
} as const satisfies Record<RedeemError, string>;

export function RedeemButton({ rewardId, problem }: { rewardId: string; problem: RedeemError | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (problem !== null) {
    return (
      <span className="chip" title={REDEEM_ERROR_MESSAGES[problem]}>
        {SHORT[problem]}
      </span>
    );
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button
        className="btn"
        style={{ padding: "0 16px" }}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await redeemReward({ rewardId });
            if (result.ok) router.push(`/app/cupom/${result.data.redemptionId}`);
            else setError(result.message);
          });
        }}
      >
        {pending ? "Resgatando…" : "Resgatar"}
      </button>
      {error !== null && (
        <p role="alert" className="small" style={{ margin: "6px 0 0" }}>
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
