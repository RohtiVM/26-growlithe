import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Camera, MapPin, Target, Zap } from "lucide-react";
import { RainCard, RainLayer } from "@/easter/rain";
import { SleepingMascot } from "@/easter/sleeping-mascot";
import { getEasterEgg } from "@/easter/weather";
import { firstName, getVisitor } from "@/server/visitor";
import { loadRainStores, loadVisitorHome } from "@/visitor/data";
import { tierProgress, TIER_LABEL } from "@/visitor/scan";
import { VisitorShell } from "@/visitor/visitor-shell";

export const metadata: Metadata = { title: "Início · Growlithe" };
export const dynamic = "force-dynamic";

const timeInPalmas = (d: Date): string =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Araguaina" });

const dateInPalmas = (d: Date): string =>
  d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Araguaina" });

/** Home do visitante (wireframe 01): nível, saldo, presença e missões em destaque. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ easter?: string | string[] }> }) {
  const visitor = await getVisitor();
  if (visitor.kind === "anonymous") redirect("/app/entrar?next=/app");
  if (visitor.name === "") redirect("/app/nome?next=/app");

  const [{ checkin, missions }, egg] = await Promise.all([
    loadVisitorHome(visitor.id),
    getEasterEgg((await searchParams).easter),
  ]);
  const rainStores = egg === "chuva" ? await loadRainStores() : [];
  const progress = tierProgress(visitor.lifetimePoints);
  const flash = missions.find((m) => m.flash && !m.done);
  const featured = missions.filter((m) => !m.flash).slice(0, 4);

  return (
    <VisitorShell tab="inicio" points={visitor.points}>
      {egg === "noite" && <SleepingMascot />}
      {egg === "chuva" && <RainLayer />}
      <div className="v-greeting reveal reveal-1">
        <p className="muted v-date">{dateInPalmas(new Date())}</p>
        <h1>Olá, {firstName(visitor.name)}</h1>
      </div>

      <section className="card v-tier reveal reveal-2" aria-label="Seu nível">
        <div className="v-tier-row">
          <span className={`tier-dot tier-${progress.tier}`} aria-hidden>
            {TIER_LABEL[progress.tier].charAt(0)}
          </span>
          <strong className="v-tier-name">Nível {TIER_LABEL[progress.tier]}</strong>
          <span className="v-tier-points tabular">{visitor.points.toLocaleString("pt-BR")}<small> pts</small></span>
        </div>
        <div className="progress"><span style={{ width: `${progress.percent}%` }} /></div>
        <p className="muted">
          {progress.next === null
            ? "Nível máximo. Você é Diamante!"
            : `Faltam ${progress.missing.toLocaleString("pt-BR")} pts para o nível ${TIER_LABEL[progress.next]}`}
        </p>
      </section>

      <section className="card v-presence reveal reveal-2">
        <MapPin size={22} aria-hidden />
        {checkin === null ? (
          <div>
            <strong>Chegou ao shopping?</strong>
            <p className="muted">Escaneie o QR da entrada: o check-in do dia vale 20 pts.</p>
          </div>
        ) : (
          <div>
            <strong>Você está no shopping</strong>
            <p className="muted">
              Check-in às {timeInPalmas(checkin.at)} · {checkin.label}
            </p>
          </div>
        )}
      </section>

      {egg === "chuva" && <RainCard stores={rainStores} />}

      {flash !== undefined && (
        <section className="flash v-flash reveal reveal-3">
          <h2 className="flash-title"><Zap size={20} aria-hidden /> {flash.title}</h2>
          <p>
            Missão Relâmpago · {flash.label} · +{flash.points} pts · até {timeInPalmas(flash.endsAt)}
          </p>
        </section>
      )}

      <section className="reveal reveal-3">
        <div className="section-head v-section-head">
          <h2>Missões em destaque</h2>
          <a href="/app/missoes">Ver todas</a>
        </div>
        {featured.length === 0 ? (
          <div className="empty">
            <Target size={28} aria-hidden />
            <strong>Nenhuma missão no momento</strong>
            <span>Escaneie os QR Codes pelo shopping: cada um vale pontos.</span>
          </div>
        ) : (
          <div className="v-missions">
            {featured.map((m) => (
              <a className="card card-link v-mission" href="/app/missoes" key={m.id}>
                <strong>{m.title}</strong>
                <div className="progress"><span style={{ width: `${Math.round((m.current / m.target) * 100)}%` }} /></div>
                <p className="muted tabular">
                  {m.done ? "Concluída" : `${m.current} de ${m.target}`} · +{m.points}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>

      <section id="escanear" className="card v-howto reveal reveal-4">
        <span className="icon-tile"><Camera size={22} aria-hidden /></span>
        <div>
          <strong>Como escanear</strong>
          <p className="muted">
            Abra a câmera do celular e aponte para um QR Code do Growlithe. O link abre aqui e os pontos entram na hora.
          </p>
        </div>
      </section>

      <a className="btn btn-secondary btn-block reveal reveal-4" href="/app/missoes">
        Ver todas as missões <ArrowRight size={18} aria-hidden />
      </a>
    </VisitorShell>
  );
}
