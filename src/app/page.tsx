import { cookies } from "next/headers";
import Link from "next/link";
import { AB_COOKIE, HEADLINES, parseVariant } from "@/landing/ab-test";
import { WaitlistForm } from "@/landing/WaitlistForm";
import { LeadProfile, TIERS, TIER_THRESHOLDS, type Tier, type Utm } from "@/domain/schemas";
import { getDb } from "@/server/db";

const TIER_LABELS = {
  bronze: "🥉 Bronze",
  prata: "🥈 Prata",
  ouro: "🥇 Ouro",
  diamante: "💎 Diamante",
} as const satisfies Record<Tier, string>;

const STEPS = [
  { title: "📷 Escaneie", text: "Aponte a câmera do celular para um QR Code do Growlithe no shopping." },
  { title: "🎯 Complete missões", text: "Check-in, caça ao tesouro, sequência de visitas e eventos." },
  { title: "🎁 Ganhe prêmios", text: "Troque pontos por estacionamento grátis, descontos e experiências." },
] as const;

const FAQ = [
  { q: "Preciso baixar um app?", a: "Não. O Growlithe abre direto no navegador do celular." },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Seguimos a LGPD: do cupom fiscal guardamos só loja, valor e horário, nunca o CPF.",
  },
  { q: "Quanto custa?", a: "Para o visitante, nada. É só passear, escanear e ganhar." },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const param = (params: SearchParams, key: string): string | null => {
  const value = params[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 60) : null;
};

export default async function LandingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cookieStore = await cookies();
  const variant = parseVariant(cookieStore.get(AB_COOKIE)?.value) ?? "A";
  const params = await searchParams;
  const profile = LeadProfile.safeParse(params.perfil);
  const utm: Utm = {
    source: param(params, "utm_source"),
    medium: param(params, "utm_medium"),
    campaign: param(params, "utm_campaign"),
  };
  const waiting = getDb().leads.length;
  /** Os CTAs mudam o perfil sem perder a UTM de onde a visita veio. */
  const ctaHref = (perfil: LeadProfile): string => {
    const query = new URLSearchParams({ perfil });
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = param(params, key);
      if (value !== null) query.set(key, value);
    }
    return `?${query.toString()}#lista-de-espera`;
  };

  return (
    <>
      <header className="container nav">
        <a className="brand" href="/">
          🔥 Growlithe
        </a>
        <nav className="row" style={{ gap: 16 }}>
          <a href="#lojistas">Para lojistas</a>
          <Link href="/app">Abrir o app</Link>
        </nav>
      </header>

      <main>
        <section className="container hero" data-variant={variant}>
          <h1>{HEADLINES[variant]}</h1>
          <p className="lead">
            Escaneie, complete missões e troque pontos por estacionamento, descontos e experiências. Sem
            instalar nada.
          </p>
          <div className="actions">
            <a className="btn" href={ctaHref("visitante")}>
              Entrar na lista de espera
            </a>
            <Link className="btn btn-secondary" href="/app">
              Experimentar agora
            </Link>
          </div>
          {waiting > 0 && (
            <p className="muted" style={{ marginTop: 16 }}>
              ⭐ {waiting.toLocaleString("pt-BR")} {waiting === 1 ? "pessoa já está" : "pessoas já estão"} na fila
            </p>
          )}
        </section>

        <section className="section">
          <div className="container">
            <h2>Como funciona</h2>
            <div className="grid">
              {STEPS.map((step) => (
                <article className="card" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="flash">
              <h2 style={{ margin: 0 }}>⚡ Missão Relâmpago</h2>
              <p>
                <strong>“Compre uma peça de roupa até as 18h: pontos em dobro.”</strong>
              </p>
              <p>Escaneie o QR do seu cupom fiscal e pronto. Vale em qualquer loja do shopping.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>Níveis e prêmios</h2>
            <div className="grid">
              {TIERS.map((tier) => (
                <article className="card" key={tier}>
                  <h3>{TIER_LABELS[tier]}</h3>
                  <p>
                    {TIER_THRESHOLDS[tier] === 0
                      ? "Seu ponto de partida"
                      : `A partir de ${TIER_THRESHOLDS[tier].toLocaleString("pt-BR")} pontos históricos`}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="lojistas">
          <div className="container">
            <h2>Para lojistas e shoppings</h2>
            <div className="grid" style={{ marginBottom: 24 }}>
              <article className="card">
                <h3>Mais gente na porta</h3>
                <p>Missões levam visitantes até as alas menos movimentadas.</p>
              </article>
              <article className="card">
                <h3>Sem integração</h3>
                <p>A compra é validada pelo QR do cupom fiscal que sua loja já emite.</p>
              </article>
              <article className="card">
                <h3>Dados em tempo real</h3>
                <p>Saiba quem visita, quando volta e quais ações funcionam.</p>
              </article>
            </div>
            <div className="actions">
              <a className="btn" href={ctaHref("lojista")}>
                Quero minha loja no Growlithe
              </a>
              <a className="btn btn-secondary" href={ctaHref("shopping")}>
                Agendar demonstração
              </a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>Perguntas frequentes</h2>
            <dl className="faq">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="section" id="lista-de-espera">
          <div className="container">
            <h2>Lista de espera</h2>
            <p className="lead">Visitantes, lojistas e shoppings: deixe seu contato e seja dos primeiros.</p>
            <WaitlistForm
              key={profile.success ? profile.data : "visitante"}
              defaultProfile={profile.success ? profile.data : "visitante"}
              utm={utm}
            />
          </div>
        </section>
      </main>

      <footer className="container footer">Growlithe · Time 26 · Missões que fazem você voltar ao shopping.</footer>
    </>
  );
}
