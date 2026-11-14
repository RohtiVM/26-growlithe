import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CheckpointRow } from "@/domain/schemas";
import { requireStaffRole } from "@/painel/access";
import { toMallInputValue } from "@/painel/missions";
import { getPainelAccess } from "@/server/staff";
import { createSupabaseServerClient } from "@/server/supabase";
import { NoAccess } from "../../no-access";
import { PainelHeader } from "../../painel-header";
import { MissionForm } from "../mission-form";

export const metadata: Metadata = { title: "Nova missão · Painel Growlithe" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Formulário A3. Os checkpoints ativos alimentam os tipos QR Code e Evento. */
export default async function NovaMissaoPage() {
  const access = await getPainelAccess();
  if (access.kind === "anonymous") redirect("/painel/login");
  const allowed = requireStaffRole(access, ["admin"]);
  if (!allowed.ok) return <NoAccess />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("checkpoints")
    .select("id, store_id, label, dynamic_qr, active")
    .eq("active", true)
    .order("label");
  const checkpoints = z
    .array(CheckpointRow)
    .catch([])
    .parse(data)
    .map((cp) => ({ id: cp.id, label: cp.label }));

  const now = new Date();
  const defaults = {
    startsAt: toMallInputValue(now),
    endsAt: toMallInputValue(new Date(now.getTime() + WEEK_MS)),
  };

  return (
    <>
      <PainelHeader staff={allowed.data} />
      <main className="container painel-main">
        <a className="back-link" href="/painel/missoes">
          <ArrowLeft size={16} aria-hidden /> Missões
        </a>
        <div className="painel-title reveal reveal-1">
          <h1>Nova missão</h1>
          <p className="lead">Escolha o tipo: os campos mudam conforme o que o visitante precisa fazer.</p>
        </div>
        <div className="reveal reveal-2">
          <MissionForm checkpoints={checkpoints} defaults={defaults} />
        </div>
      </main>
    </>
  );
}
