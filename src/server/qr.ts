/**
 * QR Code dos checkpoints: token assinado com HMAC-SHA256.
 *
 *   token = base64url(JSON { v: 1, cp, exp, sig })
 *   sig   = HMAC-SHA256(`${v}.${cp}.${exp}`, QR_SIGNING_SECRET)
 *
 * Ver docs/08-qr-code-e-gamificacao.md.
 */
import { QrPayload, type CheckpointId, type Result } from "@/domain/schemas";
import { base64url, hmacSha256, timingSafeEqual } from "./crypto";

export type QrError = "invalid_qr" | "expired_qr";

/** QR impresso: vale ~1 ano. QR dinâmico (tablet da loja): 60 s. */
export const PRINTED_QR_TTL_S = 365 * 24 * 60 * 60;
export const DYNAMIC_QR_TTL_S = 60;

const signedPart = (v: number, cp: string, exp: number): string => `${v}.${cp}.${exp}`;

export const signQrToken = async (
  checkpointId: CheckpointId,
  secret: string,
  opts: { now?: Date; ttlSeconds?: number } = {},
): Promise<string> => {
  const now = opts.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + (opts.ttlSeconds ?? PRINTED_QR_TTL_S);
  const sig = await hmacSha256(signedPart(1, checkpointId, exp), secret);
  return base64url.encode(JSON.stringify({ v: 1, cp: checkpointId, exp, sig }));
};

const decode = (token: string): unknown => {
  const json = base64url.decode(token);
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    return value;
  } catch {
    return null;
  }
};

/**
 * Aceita o token puro ou a URL inteira do QR (`https://.../s/<token>`),
 * porque o scanner do app lê a URL impressa.
 */
export const extractToken = (scanned: string): string => {
  const trimmed = scanned.trim();
  if (!URL.canParse(trimmed)) return trimmed;
  const match = /\/s\/([^/?#]+)/.exec(new URL(trimmed).pathname);
  return match?.[1] ?? trimmed;
};

export const verifyQrToken = async (
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<Result<CheckpointId, QrError>> => {
  const parsed = QrPayload.safeParse(decode(extractToken(token)));
  if (!parsed.success) return { ok: false, error: "invalid_qr", message: "QR malformado" };

  const { v, cp, exp, sig } = parsed.data;
  const expected = await hmacSha256(signedPart(v, cp, exp), secret);
  if (!timingSafeEqual(sig, expected)) {
    return { ok: false, error: "invalid_qr", message: "Assinatura inválida" };
  }
  if (exp * 1000 < now.getTime()) return { ok: false, error: "expired_qr", message: "QR expirado" };

  return { ok: true, data: cp };
};

/**
 * Código curto impresso abaixo do QR, para digitar quando a câmera falha.
 * Derivado por HMAC: não dá para adivinhar o código de outro ponto.
 */
export const MANUAL_CODE = /^[0-9A-F]{8}$/;

export const manualCode = async (checkpointId: CheckpointId, secret: string): Promise<string> =>
  (await hmacSha256(`manual:${checkpointId}`, secret)).slice(0, 8).toUpperCase();

export const resolveManualCode = async (
  raw: string,
  checkpointIds: readonly CheckpointId[],
  secret: string,
): Promise<CheckpointId | null> => {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!MANUAL_CODE.test(code)) return null;
  for (const id of checkpointIds) {
    if (timingSafeEqual(await manualCode(id, secret), code)) return id;
  }
  return null;
};

export const qrUrl = (appUrl: string, token: string): string =>
  `${appUrl.replace(/\/$/, "")}/s/${token}`;
