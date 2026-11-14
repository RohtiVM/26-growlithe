"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/painel/access";
import { isEvaluatorWindowOpen } from "@/painel/evaluator";
import { createSupabaseServerClient } from "@/server/supabase";

export type EvaluatorState = { status: "idle" } | { status: "error"; message: string };

/**
 * Spec 008: entra sem e-mail (sessão anônima) e vira admin até o fim do HackaRun.
 * Depois segue para onde estava: o scan do QR, o app ou o painel.
 */
export async function enterAsEvaluator(_prev: EvaluatorState, formData: FormData): Promise<EvaluatorState> {
  if (!isEvaluatorWindowOpen(new Date())) {
    return { status: "error", message: "O modo avaliador terminou. Entre com o seu e-mail." };
  }
  const raw = formData.get("next");
  const next = safeNextPath(typeof raw === "string" ? raw : null);

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims.sub === undefined) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error !== null) {
      return { status: "error", message: "Não conseguimos abrir o modo avaliador agora. Tente de novo em instantes." };
    }
  }
  await supabase.rpc("claim_evaluator_access");
  redirect(next);
}
