import "server-only";
import { z } from "zod";
import { painelAccess } from "@/painel/access";
import { evaluatorRoleExpired } from "@/painel/evaluator";
import type { PainelAccess } from "@/domain/schemas";
import { createSupabaseServerClient } from "./supabase";

/** Só o prazo do modo avaliador (spec 008); o resto da linha é validado por `painelAccess`. */
const EvaluatorUntil = z.object({ evaluator_until: z.string().nullable() });

/**
 * Quem está logado e qual o seu papel. Usa `getClaims` (valida a assinatura do
 * JWT), nunca `getSession`, que confia no cookie.
 */
export const getPainelAccess = async (): Promise<PainelAccess> => {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId === undefined) return painelAccess(null);

  const { data } = await supabase
    .from("profiles")
    .select("id, staff_role, store_id, evaluator_until")
    .eq("id", userId)
    .maybeSingle();
  const row: unknown = data;
  const noRole = { id: userId, staff_role: null, store_id: null };
  if (row === null) return painelAccess(noRole);

  // Spec 008: o papel de quem entrou pelo modo avaliador vence sozinho no prazo.
  // Prazo ilegível conta como vencido: nunca dá acesso por engano.
  const until = EvaluatorUntil.safeParse(row);
  if (!until.success || evaluatorRoleExpired(until.data.evaluator_until, new Date())) return painelAccess(noRole);
  return painelAccess(row);
};
