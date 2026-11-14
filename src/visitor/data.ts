import "server-only";
import { z } from "zod";
import { MissionRow, requirementLabel, type Mission } from "@/domain/schemas";
import { createSupabaseServerClient } from "@/server/supabase";

/** Data de hoje em Palmas (D4), no formato do banco (AAAA-MM-DD). */
export const todayInPalmas = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Araguaina" }).format(now);

const CheckinRow = z.object({
  scanned_at: z.string(),
  checkpoints: z.object({ label: z.string() }).nullable(),
});

const ProgressRow = z.object({
  mission_id: z.string(),
  current: z.number().int(),
  target: z.number().int(),
  completed_at: z.string().nullable(),
});

export type VisitorMission = {
  id: string;
  title: string;
  label: string;
  points: number;
  flash: boolean;
  endsAt: Date;
  current: number;
  target: number;
  done: boolean;
};

const targetOf = (m: Mission): number => {
  switch (m.requirement.kind) {
    case "qr_scan":
      return m.requirement.checkpointIds.length;
    case "visit_streak":
      return m.requirement.days;
    case "purchase":
    case "purchase_category":
    case "event_checkin":
      return 1;
  }
};

/** Check-in de hoje (critério 11) e missões ativas com o progresso do visitante. */
export const loadVisitorHome = async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const [checkinRes, missionsRes, progressRes] = await Promise.all([
    supabase
      .from("scans")
      .select("scanned_at, checkpoints(label)")
      .eq("user_id", userId)
      .eq("scanned_on", todayInPalmas())
      .eq("is_checkin", true)
      .maybeSingle(),
    supabase
      .from("missions")
      .select("*")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at"),
    supabase.from("mission_progress").select("mission_id, current, target, completed_at").eq("user_id", userId),
  ]);

  const checkin = CheckinRow.safeParse(checkinRes.data);
  const missions = z.array(MissionRow).catch([]).parse(missionsRes.data);
  const progress = new Map(
    z.array(ProgressRow).catch([]).parse(progressRes.data).map((p) => [p.mission_id, p]),
  );

  const list: VisitorMission[] = missions.map((m) => {
    const p = progress.get(m.id);
    const target = p?.target ?? targetOf(m);
    return {
      id: m.id,
      title: m.title,
      label: requirementLabel(m.requirement),
      points: m.pointsReward * (m.launch.type === "flash" ? m.launch.pointsMultiplier : 1),
      flash: m.launch.type === "flash",
      endsAt: m.endsAt,
      current: p?.completed_at != null ? target : (p?.current ?? 0),
      target,
      done: p?.completed_at != null,
    };
  });

  return {
    checkin: checkin.success
      ? { at: new Date(checkin.data.scanned_at), label: checkin.data.checkpoints?.label ?? "Entrada" }
      : null,
    missions: list,
  };
};

const RainStoreRow = z.object({ name: z.string(), category: z.enum(["vestuario", "alimentacao"]) });

/** Spec 006: lojas que combinam com dia de chuva (capas/guarda-chuvas e bebidas quentes). */
export const loadRainStores = async (): Promise<Array<{ name: string; kind: "guarda-chuva" | "bebida" }>> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("stores")
    .select("name, category")
    .eq("active", true)
    .in("category", ["vestuario", "alimentacao"])
    .order("name")
    .limit(6);
  return z
    .array(RainStoreRow)
    .catch([])
    .parse(data)
    .map((s) => ({ name: s.name, kind: s.category === "vestuario" ? "guarda-chuva" : "bebida" }));
};
