"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SendMagicLinkInput } from "@/domain/schemas";
import { createSupabaseServerClient } from "@/server/supabase";

export type MagicLinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

/** UC1: envia o link mágico. Não diz se o e-mail tem papel (não vaza quem é equipe). */
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = SendMagicLinkInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Confira o e-mail" };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/painel` },
  });
  if (error !== null) {
    return { status: "error", message: "Não conseguimos enviar o link agora. Tente de novo em 1 minuto." };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/painel/login");
}
