"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SendMagicLinkInput } from "@/domain/schemas";
import { safeNextPath } from "@/painel/access";
import { VisitorNameInput } from "@/visitor/scan";
import { createSupabaseServerClient } from "@/server/supabase";

export type VisitorLinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

/** D1: o link mágico volta para onde o visitante estava (o scan ou a Home). */
const visitorNext = (raw: FormDataEntryValue | null): string => {
  const next = safeNextPath(typeof raw === "string" ? raw : null);
  return next.startsWith("/painel") ? "/app" : next;
};

export async function sendVisitorMagicLink(_prev: VisitorLinkState, formData: FormData): Promise<VisitorLinkState> {
  const parsed = SendMagicLinkInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Confira o e-mail" };

  const next = visitorNext(formData.get("next"));
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error !== null) {
    return { status: "error", message: "Não conseguimos enviar o link agora. Tente de novo em 1 minuto." };
  }
  return { status: "sent", email: parsed.data.email };
}

export type VisitorNameState = { status: "idle" } | { status: "error"; message: string };

/** D13: o nome é pedido uma vez; depois segue para o scan ou a Home. */
export async function saveVisitorName(_prev: VisitorNameState, formData: FormData): Promise<VisitorNameState> {
  const parsed = VisitorNameInput.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Confira o nome" };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (userId === undefined) return { status: "error", message: "Sua sessão expirou. Entre de novo pelo link do e-mail." };

  const { error } = await supabase.from("profiles").update({ name: parsed.data.name }).eq("id", userId);
  if (error !== null) return { status: "error", message: "Não conseguimos salvar agora. Tente de novo em instantes." };
  redirect(visitorNext(formData.get("next")));
}

export async function signOutVisitor(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/app/entrar");
}
