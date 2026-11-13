/**
 * Variáveis de ambiente validadas com Zod. Lidas sob demanda (não no import)
 * para o build da Vercel não precisar dos segredos.
 */
import { z } from "zod";

const DEV_SECRET = "dev-only-secret-troque-em-producao-0000";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  QR_SIGNING_SECRET: z.string().min(32, "QR_SIGNING_SECRET precisa de pelo menos 32 caracteres").optional(),
  /** Senha do painel do shopping (MVP, antes do login com papéis do Supabase). */
  ADMIN_PASSCODE: z.string().min(4).optional(),
  /** URL pública usada dentro dos QR Codes impressos. */
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  /** "true" recusa scans fora do horário do shopping (10h–22h). */
  ENFORCE_MALL_HOURS: z.enum(["true", "false"]).default("false"),
  /** Web Push (avisos da Missão Relâmpago). Sem as três, o push fica desligado. */
  VAPID_PUBLIC_KEY: z.string().min(20).optional(),
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, "VAPID_SUBJECT deve ser mailto: ou https://").optional(),
  INFOSIMPLES_TOKEN: z.string().min(1).optional(),
  INFOSIMPLES_NFCE_URL: z.url().optional(),
});

export type ServerEnv = {
  qrSigningSecret: string;
  adminPasscode: string;
  appUrl: string;
  enforceMallHours: boolean;
  infosimples: { token: string; endpoint: string } | null;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
};

const emptyToUndefined = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === "" ? undefined : value;

let cached: ServerEnv | undefined;

export const serverEnv = (): ServerEnv => {
  if (cached !== undefined) return cached;
  const raw = Env.parse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, emptyToUndefined(v)])),
  );
  const isProd = raw.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
  if (isProd && raw.QR_SIGNING_SECRET === undefined) {
    throw new Error("QR_SIGNING_SECRET é obrigatório em produção");
  }
  cached = {
    qrSigningSecret: raw.QR_SIGNING_SECRET ?? DEV_SECRET,
    adminPasscode: raw.ADMIN_PASSCODE ?? "growlithe",
    appUrl:
      raw.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
    enforceMallHours: raw.ENFORCE_MALL_HOURS === "true",
    infosimples:
      raw.INFOSIMPLES_TOKEN !== undefined && raw.INFOSIMPLES_NFCE_URL !== undefined
        ? { token: raw.INFOSIMPLES_TOKEN, endpoint: raw.INFOSIMPLES_NFCE_URL }
        : null,
    vapid:
      raw.VAPID_PUBLIC_KEY !== undefined && raw.VAPID_PRIVATE_KEY !== undefined && raw.VAPID_SUBJECT !== undefined
        ? { publicKey: raw.VAPID_PUBLIC_KEY, privateKey: raw.VAPID_PRIVATE_KEY, subject: raw.VAPID_SUBJECT }
        : null,
  };
  return cached;
};
