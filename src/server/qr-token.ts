/**
 * QR Code do checkpoint: assinatura e verificação (spec 003, ticket T4; formato da docs/08).
 *
 *   token = base64url( JSON.stringify({ v: 1, cp, exp, sig }) )
 *   sig   = HMAC-SHA256( `${v}.${cp}.${exp}`, QR_SIGNING_SECRET ) em hex
 *
 * Só roda no servidor: o segredo nunca chega ao navegador (RNF04).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { QrPayload, SCAN_ERROR_MESSAGES, type CheckpointId, type Result } from "@/domain/schemas";

export const QrSigningSecret = z
  .string()
  .min(32, "QR_SIGNING_SECRET precisa de pelo menos 32 caracteres")
  .brand<"QrSigningSecret">();
export type QrSigningSecret = z.infer<typeof QrSigningSecret>;

export type QrTokenError = "invalid_qr" | "expired_qr";

const QR_VERSION = 1;

const signature = (cp: CheckpointId, exp: number, secret: QrSigningSecret): string =>
  createHmac("sha256", secret).update(`${QR_VERSION}.${cp}.${exp}`).digest("hex");

/** `exp` em segundos Unix. QR impresso: validade longa; QR dinâmico: ~60 s. */
export const signQrToken = (cp: CheckpointId, exp: number, secret: QrSigningSecret): string => {
  const payload: QrPayload = { v: QR_VERSION, cp, exp, sig: signature(cp, exp, secret) };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

const refuse = (error: QrTokenError): Result<never, QrTokenError> => ({
  ok: false,
  error,
  message: SCAN_ERROR_MESSAGES[error],
});

/** Decodifica sem lançar: qualquer lixo vira `undefined`. */
const decode = (token: string): unknown => {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
};

/** Compara em tempo constante; tamanhos diferentes já são assinatura inválida. */
const sameSignature = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
};

export const verifyQrToken = (
  token: string,
  secret: QrSigningSecret,
  now: Date,
): Result<CheckpointId, QrTokenError> => {
  const parsed = QrPayload.safeParse(decode(token));
  if (!parsed.success) return refuse("invalid_qr");

  const { cp, exp, sig } = parsed.data;
  if (!sameSignature(sig, signature(cp, exp, secret))) return refuse("invalid_qr");
  if (exp * 1000 <= now.getTime()) return refuse("expired_qr");

  return { ok: true, data: cp };
};
