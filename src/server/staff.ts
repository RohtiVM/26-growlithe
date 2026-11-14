import "server-only";
import { painelAccess } from "@/painel/access";
import type { PainelAccess } from "@/domain/schemas";
import { createSupabaseServerClient } from "./supabase";

/**
 * Quem está logado e qual o seu papel. Usa `getClaims` (valida a assinatura do
 * JWT), nunca `getSession`, que confia no cookie.
 */
export const getPainelAccess = async (): Promise<PainelAccess> => {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId === undefined) return painelAccess(null);

  const { data: row } = await supabase
    .from("profiles")
    .select("id, staff_role, store_id")
    .eq("id", userId)
    .maybeSingle();
  return painelAccess(row ?? { id: userId, staff_role: null, store_id: null });
};
