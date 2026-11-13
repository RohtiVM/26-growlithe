import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/visitor";
import { DynamicQr } from "./DynamicQr";

/** Tela cheia para o tablet da loja: o QR muda a cada 60 s (foto do QR não funciona de casa). */
export default async function TabletQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const checkpoint = db.checkpoints.find((c) => c.id === id);
  if (checkpoint === undefined) notFound();
  return <DynamicQr checkpointId={checkpoint.id} label={checkpoint.label} />;
}
