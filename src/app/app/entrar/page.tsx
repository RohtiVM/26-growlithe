import Link from "next/link";
import { redirect } from "next/navigation";
import { enterAsDemo } from "@/app/actions";
import { EnterForm } from "./EnterForm";

/** Só caminhos internos, para ninguém usar o `next` para mandar o visitante a outro site. */
const safeNext = (raw: string | string[] | undefined): string =>
  typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);

  async function demo() {
    "use server";
    await enterAsDemo();
    redirect(next);
  }

  return (
    <main className="app" style={{ paddingBottom: 32 }}>
      <Link className="brand" href="/" style={{ textDecoration: "none" }}>
        🔥 Growlithe
      </Link>
      <h1 style={{ fontSize: "1.75rem", margin: "32px 0 8px" }}>Comece a ganhar pontos</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Sem senha e sem instalar nada. Seus pontos ficam guardados neste celular.
      </p>

      <EnterForm next={next} />

      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Só quer conhecer?</p>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Entre como a Marina, uma visitante de exemplo com pontos e missões em andamento.
        </p>
        <form action={demo}>
          <button className="btn btn-ghost btn-block" type="submit">
            Entrar como visitante de demonstração
          </button>
        </form>
      </div>
    </main>
  );
}
