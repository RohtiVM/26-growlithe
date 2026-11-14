import "server-only";
import { z } from "zod";
import { evaluatorRoleExpired } from "@/painel/evaluator";
import { createSupabaseServerClient } from "./supabase";

const VisitorRow = z.object({
  id: z.string(),
  name: z.string(),
  points: z.number().int().nonnegative(),
  lifetime_points: z.number().int().nonnegative(),
  staff_role: z.enum(["admin", "lojista"]).nullable(),
  evaluator_until: z.string().nullable(),
});

export type Visitor =
  | { kind: "anonymous" }
  | {
      kind: "visitor";
      id: string;
      name: string;
      points: number;
      lifetimePoints: number;
      /** Tem papel no painel (admin ou lojista) ainda válido: mostra o atalho "Painel". */
      isStaff: boolean;
      /** Entrou pelo modo avaliador (spec 008) e o prazo não venceu: mostra o guia. */
      isEvaluator: boolean;
    };

/** Quem está usando o app do visitante. `getClaims` valida o JWT (nunca confia só no cookie). */
export const getVisitor = async (): Promise<Visitor> => {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId === undefined) return { kind: "anonymous" };

  const { data } = await supabase
    .from("profiles")
    .select("id, name, points, lifetime_points, staff_role, evaluator_until")
    .eq("id", userId)
    .maybeSingle();
  const row = VisitorRow.safeParse(data);
  if (!row.success) {
    return { kind: "visitor", id: userId, name: "", points: 0, lifetimePoints: 0, isStaff: false, isEvaluator: false };
  }
  const expired = evaluatorRoleExpired(row.data.evaluator_until, new Date());
  return {
    kind: "visitor",
    id: row.data.id,
    name: row.data.name.trim(),
    points: row.data.points,
    lifetimePoints: row.data.lifetime_points,
    isStaff: row.data.staff_role !== null && !expired,
    isEvaluator: row.data.evaluator_until !== null && !expired,
  };
};

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";
