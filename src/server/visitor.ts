import "server-only";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { expireRedemptions } from "./services";
import { currentUserId, isAdmin } from "./session";

/** Para páginas do app: devolve o visitante logado ou manda para a tela de entrar. */
export const requireVisitor = async (next?: string) => {
  const userId = await currentUserId();
  const db = getDb();
  const now = new Date();
  const user = userId === null ? undefined : db.users.find((u) => u.id === userId && u.deletedAt === null);
  if (user === undefined) {
    redirect(next === undefined ? "/app/entrar" : `/app/entrar?next=${encodeURIComponent(next)}`);
  }
  expireRedemptions(db, now);
  return { db, user, now };
};

export const requireAdmin = async () => {
  if (!(await isAdmin())) redirect("/admin/entrar");
  return { db: getDb(), now: new Date() };
};
