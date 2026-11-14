import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, QrCode } from "lucide-react";
import { requireStaffRole } from "@/painel/access";
import { dashboardFromRow, formatConversion } from "@/painel/dashboard";
import { HEADLINES } from "@/landing/ab-test";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../no-access";
import { PainelHeader } from "../painel-header";

export const metadata: Metadata = { title: "Dashboard · Painel Growlithe" };
export const dynamic = "force-dynamic";

const fmt = (n: number): string => n.toLocaleString("pt-BR");

/** UC2 / critérios 4–7: os números que o shopping hoje não tem. */
export default async function DashboardPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return <NoAccess />;

  const supabase = await createSupabaseServerClient();
  const raw: unknown = (await supabase.rpc("dashboard_metrics")).data;
  const view = dashboardFromRow(raw);

  return (
    <>
      <PainelHeader staff={allowed.data} />
      <main className="container painel-main">
        <a className="back-link" href="/painel">
          <ArrowLeft size={16} aria-hidden /> Painel
        </a>
        <div className="painel-title reveal reveal-1">
          <h1>Dashboard</h1>
          <p className="lead">Circulação, retorno e resultado das ações, em tempo real.</p>
        </div>

        {view.kind === "error" && (
          <p className="alert" role="alert">
            <AlertTriangle size={18} aria-hidden style={{ flex: "none", marginTop: 2 }} />
            Não conseguimos carregar os números agora. Recarregue a página.
          </p>
        )}

        {view.kind === "ok" && (
          <div className="dash reveal reveal-2">
            <section className="dash-figures" aria-label="Hoje e na semana">
              <div>
                <strong className="tabular">{fmt(view.metrics.checkinsToday)}</strong>
                <span>check-ins hoje</span>
              </div>
              <div>
                <strong className="tabular">{fmt(view.metrics.uniqueVisitors7d)}</strong>
                <span>visitantes nos últimos 7 dias</span>
              </div>
              <div>
                <strong className="tabular">{fmt(view.metrics.missionsCompleted)}</strong>
                <span>missões concluídas</span>
              </div>
              <div>
                <strong className="tabular">{fmt(view.metrics.redemptionsValidated)}</strong>
                <span>cupons de resgate validados</span>
              </div>
            </section>

            <section className="card dash-panel" aria-labelledby="dash-scans">
              <h2 id="dash-scans">Scans por checkpoint</h2>
              {view.empty ? (
                <div className="empty">
                  <QrCode size={28} aria-hidden />
                  <strong>Nenhum scan ainda</strong>
                  <span>
                    Imprima o QR da entrada em <a href="/painel/checkpoints">Checkpoints</a> e faça o primeiro check-in.
                  </span>
                </div>
              ) : (
                <ol className="dash-bars">
                  {view.metrics.scansByCheckpoint.map((c) => {
                    const top = view.metrics.scansByCheckpoint[0]?.scans ?? 1;
                    return (
                      <li key={c.checkpointId}>
                        <span className="dash-bar-label">{c.label}</span>
                        <span className="dash-bar-track" aria-hidden>
                          <span style={{ width: `${Math.max(4, Math.round((c.scans / top) * 100))}%` }} />
                        </span>
                        <span className="dash-bar-value tabular">{fmt(c.scans)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="card dash-panel" aria-labelledby="dash-ab">
              <h2 id="dash-ab">Landing: teste A/B da manchete</h2>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th scope="col">Variante</th>
                    <th scope="col">Visitas</th>
                    <th scope="col">Leads</th>
                    <th scope="col">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {(["A", "B"] as const).map((v) => (
                    <tr key={v}>
                      <th scope="row">
                        <span className="dash-variant">{v}</span>
                        <span className="muted">{HEADLINES[v]}</span>
                      </th>
                      <td className="tabular">{fmt(view.metrics.leads[v].visits)}</td>
                      <td className="tabular">{fmt(view.metrics.leads[v].leads)}</td>
                      <td className="tabular dash-conv">{formatConversion(view.metrics.leads[v])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
