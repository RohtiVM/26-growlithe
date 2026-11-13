import Link from "next/link";
import QRCode from "qrcode";
import { CHECKPOINT_KIND_LABELS } from "@/domain/schemas";
import { serverEnv } from "@/server/env";
import { manualCode, qrUrl, signQrToken } from "@/server/qr";
import { requireAdmin } from "@/server/visitor";
import { CheckpointForm } from "./CheckpointForm";
import { PrintButton } from "./PrintButton";

export default async function CheckpointsPage() {
  const { db } = await requireAdmin();
  const env = serverEnv();
  const cards = await Promise.all(
    db.checkpoints
      .filter((c) => c.active)
      .map(async (checkpoint) => {
        const url = qrUrl(env.appUrl, await signQrToken(checkpoint.id, env.qrSigningSecret));
        const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        const code = await manualCode(checkpoint.id, env.qrSigningSecret);
        return { checkpoint, url, svg, code };
      }),
  );

  return (
    <>
      <div className="two-col no-print">
        <section>
          <h1>QR Codes</h1>
          <p className="muted">
            Cada QR é assinado (não dá para falsificar) e vale 1 scan por visitante por dia. Imprima e coloque em
            display de mesa. Para missões de alto valor, use o modo tablet: o QR muda a cada 60 segundos.
          </p>
          <PrintButton />
        </section>
        <section>
          <h2 style={{ marginTop: 0 }}>Novo ponto</h2>
          <CheckpointForm stores={db.stores.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))} />
        </section>
      </div>

      <div className="qr-grid" style={{ marginTop: 24 }}>
        {cards.map(({ checkpoint, url, svg, code }) => (
          <article key={checkpoint.id} className="qr-card">
            <strong style={{ display: "block", marginBottom: 4 }}>{checkpoint.label}</strong>
            <span className="small">
              {CHECKPOINT_KIND_LABELS[checkpoint.kind]} · +{checkpoint.scanPoints} pts
            </span>
            {/* SVG gerado no servidor pela lib qrcode a partir de uma URL nossa. */}
            <div dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR Code de ${checkpoint.label}`} role="img" />
            <p className="small" style={{ margin: "4px 0" }}>
              Escaneie com a câmera do celular
            </p>
            <p style={{ margin: 0, fontWeight: 700, letterSpacing: "0.1em" }}>
              Código: {code.slice(0, 4)}-{code.slice(4)}
            </p>
            <div className="no-print row" style={{ justifyContent: "center", marginTop: 8, gap: 12 }}>
              <Link href={`/admin/checkpoints/${checkpoint.id}/tablet`}>Modo tablet</Link>
              <a href={url} target="_blank" rel="noreferrer">
                Testar link
              </a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
