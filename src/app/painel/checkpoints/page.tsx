import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, Printer, QrCode, Store } from "lucide-react";
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
      <main className="container painel-main">
        <a className="back-link" href="/painel">
          <ArrowLeft size={16} aria-hidden /> Painel
        </a>
        <div className="painel-title reveal reveal-1">
          <h1>Checkpoints e QR Codes</h1>
          <p className="lead">Cada checkpoint é um ponto físico com um QR Code assinado. Imprima e cole no local.</p>
        </div>

        <div className="split">
          <div className="reveal reveal-2">
            <CheckpointForm stores={stores} />
          </div>

          <section aria-labelledby="lista" className="reveal reveal-3">
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 id="lista" style={{ fontSize: "1.25rem" }}>Pontos cadastrados</h2>
              <span className="muted tabular">{checkpoints.length}</span>
            </div>
            {loadFailed && (
              <p className="alert" role="alert">
                Não conseguimos carregar os checkpoints. Recarregue a página.
              </p>
            )}
            {!loadFailed && checkpoints.length === 0 && (
              <div className="empty">
                <QrCode size={28} aria-hidden />
                <strong>Nenhum ponto ainda</strong>
                <span>Comece pela entrada principal do shopping.</span>
              </div>
            )}
            <ul className="list">
              {checkpoints.map((cp) => {
                const Icon = cp.storeId === null ? MapPin : Store;
                return (
                  <li key={cp.id} className="card list-item">
                    <div className="list-item-main">
                      <span className="icon-tile"><Icon size={20} aria-hidden /></span>
                      <div>
                        <strong>{cp.label}</strong>
                        <p className="muted">
                          {cp.storeId === null ? "Área do shopping" : (storeName.get(cp.storeId) ?? "Loja")}
                          {cp.active ? "" : " · inativo"}
                        </p>
                      </div>
                    </div>
                    <a className="btn btn-secondary btn-sm" href={`/painel/checkpoints/${cp.id}/qr`}>
                      <Printer size={16} aria-hidden /> Imprimir QR
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
