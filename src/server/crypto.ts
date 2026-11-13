/**
 * Primitivas de criptografia com Web Crypto (nativo no Node e no navegador,
 * sem dependências).
 */
const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

const keyCache = new Map<string, Promise<CryptoKey>>();

const hmacKey = (secret: string): Promise<CryptoKey> => {
  let key = keyCache.get(secret);
  if (key === undefined) {
    key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    keyCache.set(secret, key);
  }
  return key;
};

export const hmacSha256 = async (message: string, secret: string): Promise<string> =>
  toHex(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(message)));

export const sha256 = async (message: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", encoder.encode(message)));

/** Compara em tempo constante para não vazar a assinatura por tempo de resposta. */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const toBase64Url = (text: string): string => Buffer.from(text, "utf8").toString("base64url");

const fromBase64Url = (text: string): string | null => {
  try {
    return Buffer.from(text, "base64url").toString("utf8");
  } catch {
    return null;
  }
};

export const base64url = { encode: toBase64Url, decode: fromBase64Url };
