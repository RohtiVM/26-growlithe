import { LayoutDashboard, QrCode } from "lucide-react";
import { EVALUATOR_QR } from "@/painel/evaluator";

/**
 * Guia do avaliador na Home (spec 008): os passos da mini missão, com os QR
 * Codes também como links — quem está no notebook testa com um clique.
 */
export function EvaluatorGuide() {
  return (
    <section className="card evaluator-guide" aria-labelledby="guia-avaliador">
      <h2 id="guia-avaliador">Guia do avaliador</h2>
      <ol>
        <li>Escaneie o <strong>QR 1</strong> e depois o <strong>QR 2</strong> do guia (ou toque nos botões abaixo).</li>
        <li>A <strong>Caça ao tesouro do avaliador</strong> fica concluída, com pontos em dobro.</li>
        <li>Abra o <strong>painel</strong> e veja o seu scan no Dashboard; crie uma missão e imprima um QR.</li>
      </ol>
      <div className="evaluator-guide-actions">
        {EVALUATOR_QR.map((qr) => (
          <a className="btn btn-secondary btn-sm" href={qr.path} key={qr.path}>
            <QrCode size={16} aria-hidden /> {qr.label}
          </a>
        ))}
        <a className="btn btn-sm" href="/painel">
          <LayoutDashboard size={16} aria-hidden /> Abrir o painel
        </a>
      </div>
      <p className="muted evaluator-guide-note">Acesso de avaliador até 15/11 às 23h59.</p>
    </section>
  );
}
