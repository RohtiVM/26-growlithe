import { z } from "zod";
import { QrSigningSecret } from "./qr-token";

/** Variáveis públicas do Supabase, validadas na borda (RNF06). */
const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL ausente ou inválida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente"),
});

export const publicEnv = () =>
  PublicEnv.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

/**
 * Segredo que assina os QR Codes (RNF04). Sem prefixo NEXT_PUBLIC_: nunca vai
 * para o navegador. Validado na borda, falha cedo se faltar.
 */
export const qrSigningSecret = () => QrSigningSecret.parse(process.env.QR_SIGNING_SECRET);