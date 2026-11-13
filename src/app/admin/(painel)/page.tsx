import { HEADLINES } from "@/landing/ab-test";
import { adminMetrics } from "@/server/services";
import { requireAdmin } from "@/server/visitor";
import { AutoRefresh } from "@/ui/components/AutoRefresh";
import { formatPoints } from "@/ui/labels";

const pct = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)}%`);

export default async function AdminDashboard() {
  const { db, now } = await requireAdmin();
  const m = adminMetrics(db, now);
  const leader = m.leads.A === m.leads.B ? null : m.leads.A > m.leads.B ? "A" : "B";

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      <h1>Visão geral</h1>
      <div className="stats">
        <div className="stat">
          <span className="muted small">Visitantes hoje</span>
          <strong>{m.visitorsToday}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Scans hoje</span>
          <strong>{m.scansToday}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Visitantes que voltaram</span>
          <strong>
            {m.returning}/{m.visitors}
          </strong>
        </div>
        <div className="stat">
          <span className="muted small">Pontos distribuídos</span>
          <strong>{formatPoints(m.pointsIssued)}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Compras validadas (cupom fiscal)</span>
          <strong>{m.receipts}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Cupons de resgate usados</span>
          <strong>
            {m.redemptions.redeemed}
            <span className="muted small"> / {m.redemptions.reserved} abertos</span>
          </strong>
        </div>
      </div>

      <div className="two-col">
        <section>
          <h2>Circulação por ponto</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ponto</th>
                  <th>Hoje</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {m.byCheckpoint.map(({ checkpoint, today, total }) => (
                  <tr key={checkpoint.id}>
                    <td>{checkpoint.label}</td>
                    <td className="tabular">{today}</td>
                    <td className="tabular">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Landing page: lista de espera</h2>
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat">
              <span className="muted small">Cadastros</span>
              <strong>{m.leads.total}</strong>
            </div>
            <div className="stat">
              <span className="muted small">Lojistas</span>
              <strong>{m.leads.byProfile.lojista}</strong>
            </div>
            <div className="stat">
              <span className="muted small">Shoppings</span>
              <strong>{m.leads.byProfile.shopping}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <caption className="muted small" style={{ textAlign: "left", padding: "8px 12px" }}>
                Teste A/B de manchete {leader !== null && `· na frente: ${leader}`}
              </caption>
              <thead>
                <tr>
                  <th>Variante</th>
                  <th>Cadastros</th>
                  <th>Parcela</th>
                </tr>
              </thead>
              <tbody>
                {(["A", "B"] as const).map((v) => (
                  <tr key={v}>
                    <td>
                      <strong>{v}</strong> · {HEADLINES[v]}
                    </td>
                    <td className="tabular">{m.leads[v]}</td>
                    <td className="tabular">{pct(m.leads[v], m.leads.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.leads.bySource.length > 0 && (
            <>
              <h2>Origem dos cadastros (UTM)</h2>
              <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
                {m.leads.bySource.map(([source, count]) => (
                  <li key={source} className="row between card" style={{ padding: "10px 14px" }}>
                    <span>{source}</span>
                    <strong className="tabular">{count}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="muted small">
            A taxa de conversão (cadastros ÷ visitas) sai do Vercel Analytics, que conta as visitas da página.
          </p>
        </section>
      </div>
    </>
  );
}
