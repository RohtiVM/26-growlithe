"use server";

import { revalidatePath } from "next/cache";
import { createCheckpoint } from "@/painel/checkpoints";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";

export type CreateCheckpointState =
  | { status: "idle" }
  | { status: "created"; label: string }
  | { status: "error"; message: string };

/** UC6. O papel é conferido no servidor (RNF01) e de novo pela RLS do banco (RNF02). */
export async function createCheckpointAction(
  _prev: CreateCheckpointState,
  formData: FormData,
): Promise<CreateCheckpointState> {
  const storeId = formData.get("storeId");
  const access = await getPainelAccess();
  const supabase = await createSupabaseServerClient();

  const result = await createCheckpoint(
    access,
    {
      storeId: typeof storeId === "string" && storeId !== "" ? storeId : null,
      label: formData.get("label"),
      dynamicQr: false,
    },
    async (values) => await supabase.from("checkpoints").insert(values).select().single(),
  );

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/painel/checkpoints");
  return { status: "created", label: result.data.label };
}
