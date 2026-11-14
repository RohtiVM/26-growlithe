import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, Flame } from "lucide-react";
import { z } from "zod";
import { CheckpointId, CheckpointRow } from "@/domain/schemas";
import { requireStaffRole } from "@/painel/access";
import { checkpointScanUrl, printedQrExpiry } from "@/painel/checkpoints";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../../../no-access";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "QR do checkpoint · Painel Growlithe" };

/**
 * UC7 / critério 13: o banco assina o QR (`sign_checkpoint_qr`, spec 004 D16).
 * O segredo só existe no banco: nem o navegador nem o servidor do app o veem.
 */
export default async function CheckpointQrPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  if (!requireStaffRole(access, ["admin"]).ok) return <NoAccess />;

  const id = CheckpointId.safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data }, signed] = await Promise.all([
    supabase
      .from("checkpoints")
      .select("id, store_id, label, dynamic_qr, active")
      .eq("id", id.data)
      .maybeSingle(),
    supabase.rpc("sign_checkpoint_qr", { p_checkpoint: id.data }),
  ]);
  const checkpoint = CheckpointRow.safeParse(data);
  const token = z.string().regex(/^[A-Za-z0-9_-]+$/).safeParse(signed.data);
  if (!checkpoint.success || !token.success) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  // O banco assina com validade de 1 ano; a data abaixo só informa quando reimprimir.
  const exp = printedQrExpiry(new Date());
  const url = checkpointScanUrl(origin, token.data);
  // Preto no branco e margem larga: lê bem impresso e em qualquer câmera, nos dois temas.
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#FFFFFF" } });
  const validUntil = new Date(exp * 1000).toLocaleDateString("pt-BR");

  return (
    <main className="container narrow qr-sheet painel-main">
      <a className="back-link no-print" href="/painel/checkpoints">
        <ArrowLeft size={16} aria-hidden /> Checkpoints
      </a>
      <p className="brand" style={{ justifyContent: "center", width: "100%" }}>
        <Flame size={22} aria-hidden /> Growlithe
      </p>
      <h1>Escaneie e ganhe pontos</h1>
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
