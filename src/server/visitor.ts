import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "./supabase";

const VisitorRow = z.object({
  id: z.string(),
  name: z.string(),
  points: z.number().int().nonnegative(),
  lifetime_points: z.number().int().nonnegative(),
});

export type Visitor =
  | { kind: "anonymous" }
  | { kind: "visitor"; id: string; name: string; points: number; lifetimePoints: number };

/** Quem está usando o app do visitante. `getClaims` valida o JWT (nunca confia só no cookie). */
export const getVisitor = async (): Promise<Visitor> => {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId === undefined) return { kind: "anonymous" };

  const { data } = await supabase
    .from("profiles")
    .select("id, name, points, lifetime_points")
    .eq("id", userId)
    .maybeSingle();
  const row = VisitorRow.safeParse(data);
  if (!row.success) return { kind: "visitor", id: userId, name: "", points: 0, lifetimePoints: 0 };
  return {
    kind: "visitor",
    id: row.data.id,
    name: row.data.name.trim(),
    points: row.data.points,
    lifetimePoints: row.data.lifetime_points,
  };
};

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";
