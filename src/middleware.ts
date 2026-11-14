import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AB_COOKIE, parseVariant, pickVariant } from "@/landing/ab-test";

/** Landing: fixa a variante do teste A/B no primeiro acesso. */
const withAbVariant = (request: NextRequest): NextResponse => {
  if (parseVariant(request.cookies.get(AB_COOKIE)?.value) !== null) return NextResponse.next();
  const variant = pickVariant();
  request.cookies.set(AB_COOKIE, variant);
  const response = NextResponse.next({ request });
  response.cookies.set(AB_COOKIE, variant, { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/" });
  return response;
};

/**
 * Painel: renova o token do Supabase a cada requisição (Server Components não
 * gravam cookie). `getClaims` valida o JWT e dispara a renovação quando preciso.
 */
const withSupabaseSession = async (request: NextRequest): Promise<NextResponse> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || key === undefined) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return request.nextUrl.pathname === "/" ? withAbVariant(request) : withSupabaseSession(request);
}

export const config = { matcher: ["/", "/painel/:path*", "/auth/:path*"] };
