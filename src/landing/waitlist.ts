/**
 * Lista de espera da landing page (spec 002, T4). Regras puras: o servidor
 * injeta o cookie da variante, a UTM e a função que grava no banco.
 */
import { z } from "zod";
import {
  Utm,
  WAITLIST_FIELDS,
  WAITLIST_OUTCOME_MESSAGES,
  WAITLIST_SAVE_FAILED_MESSAGE,
  WaitlistOutcome,
  WaitlistContact,
  WaitlistProfile,
  assertNever,
  type JoinWaitlistInput,
  type LeadProfile,
  type WaitlistDraft,
  type WaitlistFieldErrors,
} from "@/domain/schemas";
import { parseVariant, type Variant } from "./ab-test";

/** Argumentos de `public.join_waitlist` (migration 20261114110000_lista_de_espera). */
export type JoinWaitlistRpcArgs = {
  p_name: string;
  p_email: string;
  p_profile: LeadProfile;
  p_company: string | null;
  p_variant: Variant;
  p_utm_source: string | null;
  p_utm_medium: string | null;
  p_utm_campaign: string | null;
  p_consent_lgpd: true;
};

/** Resposta mínima do cliente Supabase que nos interessa. */
export type JoinWaitlistRpc = (args: JoinWaitlistRpcArgs) => Promise<{ data: unknown; error: unknown }>;

export type WaitlistState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: WaitlistFieldErrors; values: WaitlistDraft }
  | { status: "error"; message: string; values: WaitlistDraft }
  | { status: WaitlistOutcome; message: string };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** FormData → rascunho. Nunca lança: campo ausente vira texto vazio. */
export const readWaitlistForm = (form: FormData): WaitlistDraft => ({
  name: text(form.get("name")),
  email: text(form.get("email")),
  profile: text(form.get("profile")),
  company: text(form.get("company")),
  consentLgpd: form.get("consentLgpd") === "on",
});

const isField = (key: PropertyKey | undefined): key is (typeof WAITLIST_FIELDS)[number] =>
  WAITLIST_FIELDS.some((field) => field === key);

export const validateWaitlist = (
  draft: WaitlistDraft,
): { ok: true; data: JoinWaitlistInput } | { ok: false; fieldErrors: WaitlistFieldErrors } => {
  const contact = WaitlistContact.safeParse(draft);
  const profile = WaitlistProfile.safeParse(draft);
  if (contact.success && profile.success) {
    const { name, email, consentLgpd } = contact.data;
    return { ok: true, data: { name, email, consentLgpd, ...profile.data } };
  }

  const issues = [...(contact.error?.issues ?? []), ...(profile.error?.issues ?? [])];
  const fieldErrors: WaitlistFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    // Primeira mensagem de cada campo: a mais básica ("conta seu nome" antes de "use até 80").
    if (isField(field) && fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
  }
  return { ok: false, fieldErrors };
};

/** Rótulo do campo de empresa; `null` quando o perfil não pede empresa. */
export const companyLabel = (profile: LeadProfile): string | null => {
  switch (profile) {
    case "visitante":
      return null;
    case "lojista":
      return "Nome da loja";
    case "shopping":
      return "Nome do shopping";
    default:
      return assertNever(profile);
  }
};

/** D6: a variante vem do cookie fixado pelo middleware. Ausente ou adulterado vira "A". */
export const variantFromCookie = (raw: string | undefined): Variant => parseVariant(raw) ?? "A";

const utmValue = (schema: z.ZodType<string | null>, raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = schema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
};

/**
 * D6: UTM lida da URL pelo servidor e validada campo a campo com `Utm`.
 * Valor inválido vira `null`: uma UTM ruim nunca impede o cadastro.
 */
export const readUtm = (raw: { source: unknown; medium: unknown; campaign: unknown }): Utm => ({
  source: utmValue(Utm.shape.source, raw.source),
  medium: utmValue(Utm.shape.medium, raw.medium),
  campaign: utmValue(Utm.shape.campaign, raw.campaign),
});

/** Critérios 4–6: valida, grava com variante e UTM do servidor e trata e-mail repetido sem erro. */
export const joinWaitlist = async (
  form: FormData,
  context: { variantCookie: string | undefined; utm: Utm },
  rpc: JoinWaitlistRpc,
): Promise<WaitlistState> => {
  const values = readWaitlistForm(form);
  const valid = validateWaitlist(values);
  if (!valid.ok) return { status: "invalid", fieldErrors: valid.fieldErrors, values };

  const lead = valid.data;
  const { data, error } = await rpc({
    p_name: lead.name,
    p_email: lead.email,
    p_profile: lead.profile,
    p_company: lead.company,
    p_variant: variantFromCookie(context.variantCookie),
    p_utm_source: context.utm.source,
    p_utm_medium: context.utm.medium,
    p_utm_campaign: context.utm.campaign,
    p_consent_lgpd: lead.consentLgpd,
  });

  const outcome = WaitlistOutcome.safeParse(data);
  if (error !== null || !outcome.success) {
    return { status: "error", message: WAITLIST_SAVE_FAILED_MESSAGE, values };
  }
  return { status: outcome.data, message: WAITLIST_OUTCOME_MESSAGES[outcome.data] };
};
