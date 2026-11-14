"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/server/supabase";
import { AB_COOKIE } from "./ab-test";
import { joinWaitlist, readUtm, type WaitlistState } from "./waitlist";

/**
 * Spec 002 · T4. Funciona sem login: a função `join_waitlist` é executável por `anon`.
 * A variante vem só do cookie (D6). A UTM chega da URL da página e é revalidada aqui.
 */
export async function joinWaitlistAction(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const cookieStore = await cookies();

  return joinWaitlist(
    formData,
    {
      variantCookie: cookieStore.get(AB_COOKIE)?.value,
      utm: readUtm({
        source: formData.get("utm_source"),
        medium: formData.get("utm_medium"),
        campaign: formData.get("utm_campaign"),
      }),
    },
    async (args) => {
      try {
        const supabase = await createSupabaseServerClient();
        return await supabase.rpc("join_waitlist", args);
      } catch (error: unknown) {
        // Env ausente ou rede fora: vira a mensagem amigável, nunca a tela de erro.
        return { data: null, error };
      }
    },
  );
}
