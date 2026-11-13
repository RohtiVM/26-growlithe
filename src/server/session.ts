/**
 * Sessão do MVP: cookie com o id do visitante + assinatura HMAC.
 * Sem a assinatura, ninguém troca o id no cookie para virar outra pessoa.
 * (Quando o Supabase Auth entrar, este módulo é o único a mudar.)
 */
import { cookies } from "next/headers";
import { UserId } from "@/domain/schemas";
import { hmacSha256, timingSafeEqual } from "./crypto";
import { serverEnv } from "./env";

const SESSION_COOKIE = "gl_session";
const ADMIN_COOKIE = "gl_admin";
const MAX_AGE = 60 * 60 * 24 * 90;

const sign = (value: string) => hmacSha256(`session:${value}`, serverEnv().qrSigningSecret);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
} as const;

export const startSession = async (userId: UserId): Promise<void> => {
  const store = await cookies();
  store.set(SESSION_COOKIE, `${userId}.${await sign(userId)}`, cookieOptions);
};

export const endSession = async (): Promise<void> => {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
};

export const currentUserId = async (): Promise<UserId | null> => {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw === undefined) return null;
  const [id, sig] = raw.split(".");
  if (id === undefined || sig === undefined || !timingSafeEqual(sig, await sign(id))) return null;
  const parsed = UserId.safeParse(id);
  return parsed.success ? parsed.data : null;
};

export const startAdminSession = async (): Promise<void> => {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await sign("admin"), { ...cookieOptions, maxAge: 60 * 60 * 12 });
};

export const endAdminSession = async (): Promise<void> => {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
};

export const isAdmin = async (): Promise<boolean> => {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  return raw !== undefined && timingSafeEqual(raw, await sign("admin"));
};
