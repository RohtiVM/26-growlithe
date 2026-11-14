import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { CheckpointId, CheckpointRow } from "@/domain/schemas";
import { requireStaffRole } from "@/painel/access";
import { checkpointScanUrl, printedQrExpiry } from "@/painel/checkpoints";
import { qrSigningSecret } from "@/server/env";
import { signQrToken } from "@/server/qr-token";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../../../no-access";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR do checkpoint · Painel Growlithe" };

/** UC7 / critério 13: QR assinado no servidor; o segredo nunca chega ao navegador. */
export default async function CheckpointQrPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  if (!requireStaffRole(access, ["admin"]).ok) return <NoAccess />;

  const id = CheckpointId.safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("checkpoints")
    .select("id, store_id, label, dynamic_qr, active")
    .eq("id", id.data)
    .maybeSingle();
  const checkpoint = CheckpointRow.safeParse(data);
  if (!checkpoint.success) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const now = new Date();
  const exp = printedQrExpiry(now);
  const url = checkpointScanUrl(origin, signQrToken(checkpoint.data.id, exp, qrSigningSecret()));
  // Preto no branco e margem larga: lê bem impresso e em qualquer câmera, nos dois temas.
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#FFFFFF" } });
  const validUntil = new Date(exp * 1000).toLocaleDateString("pt-BR");

  return (
    <main className="container narrow qr-sheet">
      <p className="no-print">
        <a href="/painel/checkpoints">← Checkpoints</a>
      </p>
      <h1>🔥 Escaneie e ganhe pontos</h1>
      <p className="lead">{checkpoint.data.label}</p>
      <div className="qr-code" role="img" aria-label={`QR Code do checkpoint ${checkpoint.data.label}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p>Aponte a câmera do celular. Não precisa instalar nada.</p>
      <p className="muted">Válido até {validUntil}. Depois, imprima um novo.</p>
      <div className="actions no-print">
        <PrintButton />
      </div>
    </main>
  );
}
