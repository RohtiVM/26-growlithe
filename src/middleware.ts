import { NextResponse, type NextRequest } from "next/server";
import { AB_COOKIE, parseVariant, pickVariant } from "@/landing/ab-test";

/** Fixa a variante do teste A/B no primeiro acesso, para o visitante ver sempre a mesma manchete. */
export function middleware(request: NextRequest): NextResponse {
  if (parseVariant(request.cookies.get(AB_COOKIE)?.value) !== null) return NextResponse.next();

  const variant = pickVariant();
  // Disponível já nesta requisição para a página renderizar a variante certa.
  request.cookies.set(AB_COOKIE, variant);
  const response = NextResponse.next({ request });
  response.cookies.set(AB_COOKIE, variant, {
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export const config = { matcher: ["/"] };
