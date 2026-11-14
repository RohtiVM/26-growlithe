import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/painel/access";
import { createSupabaseServerClient } from "@/server/supabase";

/** Volta do link mágico (fluxo PKCE): troca o código pela sessão e segue para o painel ou o app. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code !== null) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error === null) return NextResponse.redirect(`${origin}${next}`);
  }
  // Link vencido: volta para a tela de login certa (painel ou visitante).
  if (next.startsWith("/painel")) return NextResponse.redirect(`${origin}/painel/login?erro=link`);
  return NextResponse.redirect(`${origin}/app/entrar?erro=link&next=${encodeURIComponent(next)}`);
}
