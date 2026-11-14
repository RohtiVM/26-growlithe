"use server";

import { z } from "zod";
import { assertNever, formatMallDateTime, type Tier } from "@/domain/schemas";
import { confirmRedemption, previewRedemption } from "@/painel/redemptions";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";

/** Estado da tela A5. Datas já formatadas no horário do shopping. */
export type ValidarState =
  | { step: "idle" }
  | {
      step: "preview";
      code: string;
      rewardTitle: string;
      benefitText: string;
      firstName: string;
      tier: Tier;
      expiresAt: string;
    }
  | { step: "done"; benefitText: string; firstName: string; redeemedAt: string }
  | { step: "error"; code: string; message: string };

const Intent = z.enum(["conferir", "confirmar"]);

/**
 * UC8. O botão "Conferir código" manda `intent=conferir` (só lê); "Confirmar
 * resgate" manda `intent=confirmar` (valida no banco, de forma atômica).
 * O papel é conferido aqui no servidor (RNF01) e de novo pela função Postgres.
 */
export async function validarCupomAction(prev: ValidarState, formData: FormData): Promise<ValidarState> {
  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  const intent = Intent.safeParse(formData.get("intent"));
  if (!intent.success) return { step: "error", code, message: "Ação desconhecida. Recarregue a página e tente de novo." };

  const access = await getPainelAccess();
  const supabase = await createSupabaseServerClient();

  const which = intent.data;
  switch (which) {
    case "conferir": {
      const r = await previewRedemption(access, code, async (c) => await supabase.rpc("preview_redemption", { p_code: c }));
      if (!r.ok) return { step: "error", code, message: r.message };
      return {
        step: "preview",
        code: r.data.code,
        rewardTitle: r.data.rewardTitle,
        benefitText: r.data.benefitText,
        firstName: r.data.firstName,
        tier: r.data.tier,
        expiresAt: formatMallDateTime(r.data.expiresAt),
      };
    }
    case "confirmar": {
      const r = await confirmRedemption(access, code, async (c) => await supabase.rpc("validate_redemption", { p_code: c }));
      if (!r.ok) return { step: "error", code, message: r.message };
      // O que foi mostrado na conferência; o banco já decidiu que vale.
      const shown = prev.step === "preview" && prev.code === code ? prev : null;
      return {
        step: "done",
        benefitText: shown?.benefitText ?? `Cupom de resgate ${code}`,
        firstName: shown?.firstName ?? "o visitante",
        redeemedAt: formatMallDateTime(r.data.redeemedAt),
      };
    }
    default:
      return assertNever(which);
  }
}
