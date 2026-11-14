import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CheckpointRow } from "@/domain/schemas";
import { requireStaffRole } from "@/painel/access";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../no-access";
import { PainelHeader } from "../painel-header";
import { CheckpointForm } from "./checkpoint-form";

export const metadata: Metadata = { title: "Checkpoints · Painel Growlithe" };

const StoreOption = z.object({ id: z.string(), name: z.string() });

export default async function CheckpointsPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return <NoAccess />;

  const supabase = await createSupabaseServerClient();
  const [checkpointsRes, storesRes] = await Promise.all([
    supabase.from("checkpoints").select("id, store_id, label, dynamic_qr, active").order("label"),
    supabase.from("stores").select("id, name").eq("active", true).order("name"),
  ]);

  // Borda do banco: linha que não bate com o schema não entra na tela.
  const checkpoints = z.array(CheckpointRow).catch([]).parse(checkpointsRes.data);
  const stores = z.array(StoreOption).catch([]).parse(storesRes.data);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const loadFailed = checkpointsRes.error !== null;

  return (
    <>
      <PainelHeader staff={allowed.data} />
      <main className="container">
        <p>
          <a href="/painel">← Painel</a>
        </p>
        <h1>Checkpoints e QR Codes</h1>
        <p className="lead">Cada checkpoint é um ponto físico com um QR Code assinado. Imprima e cole no local.</p>

        <div className="grid" style={{ alignItems: "start" }}>
          <CheckpointForm stores={stores} />

          <section aria-labelledby="lista">
            <h2 id="lista">Pontos cadastrados</h2>
            {loadFailed && (
              <p className="alert" role="alert">
                ⚠️ Não conseguimos carregar os checkpoints. Recarregue a página.
              </p>
            )}
            {!loadFailed && checkpoints.length === 0 && (
              <p className="muted">Nenhum ponto ainda. Comece pela entrada principal do shopping.</p>
            )}
            <ul className="list">
              {checkpoints.map((cp) => (
                <li key={cp.id} className="card list-item">
                  <div>
                    <strong>{cp.label}</strong>
                    <p className="muted">
                      {cp.storeId === null ? "Área do shopping" : (storeName.get(cp.storeId) ?? "Loja")}
                      {cp.active ? "" : " · inativo"}
                    </p>
                  </div>
                  <a className="btn btn-secondary" href={`/painel/checkpoints/${cp.id}/qr`}>
                    Imprimir QR
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
