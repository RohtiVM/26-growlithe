import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { painelHomePath } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar no painel · Growlithe" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const access = await getPainelAccess();
  if (access.kind === "staff") redirect(painelHomePath(access.staff));
  const { erro } = await searchParams;

  return (
    <main className="container narrow">
      <h1>Painel do shopping</h1>
      <p className="lead">Entre com o e-mail cadastrado pelo marketing do shopping. Sem senha: enviamos um link.</p>
      <LoginForm linkError={erro === "link"} />
    </main>
  );
}
