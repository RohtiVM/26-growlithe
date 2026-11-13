import { requireVisitor } from "@/server/visitor";
import { AutoScan } from "./AutoScan";

/**
 * Link universal do QR impresso: quem escaneia com a câmera nativa do celular
 * cai aqui, entra (se precisar) e o scan acontece sozinho.
 * O scan roda por Server Action no cliente, e não no GET, para um preview de
 * link ou um prefetch nunca gastar o scan do dia.
 */
export default async function UniversalScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireVisitor(`/s/${token}`);
  return (
    <main className="app" style={{ paddingBottom: 32 }}>
      <AutoScan token={token} />
    </main>
  );
}
