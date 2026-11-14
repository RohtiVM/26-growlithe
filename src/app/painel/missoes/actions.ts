"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMission, endMission, type MissionFieldErrors, type MissionFormField } from "@/painel/missions";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";

/** Campos de texto do formulário A3 (`checkpointIds` é o único com vários valores). */
const SCALAR_FIELDS = [
  "title",
  "description",
  "kind",
  "ordered",
  "days",
  "checkpointId",
  "eventName",
  "category",
  "launchType",
  "pushTitle",
  "pushBody",
  "pointsMultiplier",
  "pointsReward",
  "startsAt",
  "endsAt",
  "maxCompletionsPerUser",
] as const satisfies readonly Exclude<MissionFormField, "checkpointIds">[];

/** O que foi digitado, para devolver ao formulário quando há erro. */
export type MissionFormValues = Partial<Record<(typeof SCALAR_FIELDS)[number], string>> & {
  checkpointIds?: readonly string[];
};

export type CreateMissionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: MissionFieldErrors; values: MissionFormValues };

const asText = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "");

/** UC3 + UC5. O papel é conferido no servidor (RNF01) e de novo pela RLS do banco (RNF02). */
export async function createMissionAction(
  _prev: CreateMissionState,
  formData: FormData,
): Promise<CreateMissionState> {
  const values: MissionFormValues = {
    ...Object.fromEntries(SCALAR_FIELDS.map((k) => [k, asText(formData.get(k))])),
    checkpointIds: formData.getAll("checkpointIds").map(asText),
  };
  const access = await getPainelAccess();
  const supabase = await createSupabaseServerClient();

  const result = await createMission(
    access,
    values,
    async (row) => await supabase.from("missions").insert(row).select().single(),
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldErrors: result.error === "invalid_input" ? result.fieldErrors : {},
      values,
    };
  }
  revalidatePath("/painel/missoes");
  redirect("/painel/missoes?criada=1");
}

export type EndMissionState = { status: "idle" } | { status: "error"; message: string };

/** UC4 / critério 12. O banco reconfere: só missão ativa, e o fim vira o `now()` dele. */
export async function endMissionAction(_prev: EndMissionState, formData: FormData): Promise<EndMissionState> {
  const access = await getPainelAccess();
  const supabase = await createSupabaseServerClient();

  const result = await endMission(
    access,
    { missionId: formData.get("missionId") },
    new Date(),
    async ({ id, now }) =>
      await supabase
        .from("missions")
        .update({ ends_at: now })
        .eq("id", id)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .select()
        .maybeSingle(),
  );

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/painel/missoes");
  return { status: "idle" };
}
