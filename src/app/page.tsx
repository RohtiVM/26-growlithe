import { cookies } from "next/headers";
import { Flame, Gift, Plus, ScanLine, Sparkles, Store, Target, Zap, BarChart3, Users } from "lucide-react";
import { AB_COOKIE, HEADLINES, parseVariant } from "@/landing/ab-test";
import { Countdown } from "@/landing/countdown";
import { readUtm } from "@/landing/waitlist";
import { WaitlistForm } from "@/landing/waitlist-form";
import { TIERS, TIER_THRESHOLDS, type Tier } from "@/domain/schemas";
import { RainCard, RainLayer } from "@/easter/rain";
import { SleepingMascot } from "@/easter/sleeping-mascot";
import { getEasterEgg } from "@/easter/weather";

const TIER_INFO = {
  bronze: { label: "Bronze", initial: "B", perk: "Café e descontos em lanchonetes" },
  prata: { label: "Prata", initial: "P", perk: "Estacionamento grátis" },
  ouro: { label: "Ouro", initial: "O", perk: "Ingressos de cinema" },
  diamante: { label: "Diamante", initial: "D", perk: "Pré-estreias e experiências VIP" },
} as const satisfies Record<Tier, { label: string; initial: string; perk: string }>;

const STEPS = [
  {
    icon: ScanLine,
    title: "Escaneie",
    text: "Aponte a câmera para o QR Code do Growlithe na entrada, nas lojas e nos eventos.",
  },
  {
    icon: Target,
    title: "Complete missões",
    text: "Caça ao tesouro, visitas seguidas, eventos e desafios relâmpago com pontos em dobro.",
  },
  {
    icon: Gift,
    title: "Ganhe prêmios",
    text: "Troque pontos por estacionamento grátis, descontos nas lojas e experiências.",
  },
] as const;

const FEATURES = [
  { icon: Users, title: "Mais gente na porta", text: "Missões levam visitantes até a sua loja, inclusive em alas pouco movimentadas." },
  { icon: Store, title: "Zero integração", text: "As compras são validadas pelo QR Code que já vem em todo cupom fiscal." },
  { icon: BarChart3, title: "Dados em tempo real", text: "Circulação por loja e horário, retorno dos visitantes e resultado de cada campanha." },
] as const;

const FAQ = [
  { q: "Preciso baixar um aplicativo?", a: "Não. O Growlithe abre direto no navegador do celular, pela câmera." },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Seguimos a LGPD: do cupom fiscal guardamos só loja, valor e horário, nunca o CPF.",
  },
  { q: "Quanto custa?", a: "Para o visitante, nada. É só passear, escanear e ganhar." },
] as const;

const fmt = (n: number): string => n.toLocaleString("pt-BR");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LandingPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const params = await searchParams;
  // Easter egg de sexta-feira 13 (spec 006): madrugada ou chuva forte em Palmas.
  const egg = await getEasterEgg(params.easter);
  // D6: UTM do cartaz/QR lida aqui no servidor; a Server Action revalida.
  const utm = readUtm({ source: params.utm_source, medium: params.utm_medium, campaign: params.utm_campaign });
  const variant = parseVariant(cookieStore.get(AB_COOKIE)?.value) ?? "A";

  return (
    <>
      <header className="site-header">
        <nav className="container nav" aria-label="Principal">
          <a className="brand" href="/">
            <Flame size={20} aria-hidden /> Growlithe
          </a>
          <div className="nav-links">
            <a className="nav-link" href="#como-funciona">Como funciona</a>
            <a className="nav-link" href="#premios">Prêmios</a>
            <a className="nav-link" href="#lojistas">Para lojistas</a>
            <a className="btn btn-sm" href="#lista-de-espera">Entrar na lista</a>
          </div>
        </nav>
      </header>

      {egg === "noite" && <SleepingMascot />}
      {egg === "chuva" && <RainLayer />}
      <main>
        <section className="container hero" data-variant={variant}>
          <div>
            <h1 className="reveal reveal-1">{HEADLINES[variant]}</h1>
            <p className="lead reveal reveal-2">
              Escaneie QR Codes nas lojas, complete missões e troque pontos por estacionamento, descontos e
              experiências. Sem baixar nada: abre direto pela câmera do celular.
            </p>
            <div className="actions reveal reveal-3">
              <a className="btn" href="#lista-de-espera">Entrar na lista de espera</a>
              <a className="btn btn-secondary" href="#como-funciona">Ver como funciona</a>
            </div>
            <p className="hero-note reveal reveal-4">
              <Zap size={16} aria-hidden /> Shopping Capim Dourado · Palmas, TO
            </p>
          </div>

          <div className="hero-visual reveal reveal-3" aria-hidden>
            <div className="hero-glow" />
            <div className="phone">
            <p className="phone-greeting">Olá, Marina</p>
            <div className="phone-card">
              <div className="phone-row">
                <span>Nível Prata</span>
                <span className="phone-points tabular">1.240 pts</span>
              </div>
              <div className="progress"><span style={{ width: "62%" }} /></div>
            </div>
            <div className="phone-card phone-flash">
              <div className="phone-row"><span><Zap size={12} /> Missão Relâmpago · ×2</span></div>
              <strong>Compre uma peça de roupa em qualquer loja</strong>
            </div>
            <div className="phone-card">
              <strong>Caça ao tesouro da Ala B</strong>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: "40%" }} /></div>
            </div>
            <span className="phone-scan"><ScanLine size={24} /></span>
            </div>
            <span className="hero-chip"><Sparkles size={16} /> +20 pts · check-in</span>
          </div>
        </section>

        {egg === "chuva" && (
          <div className="container egg-rain-slot">
            <RainCard stores={[]} />
          </div>
        )}

        <section className="section container" id="como-funciona">
          <div className="section-intro">
            <h2>Como funciona</h2>
            <p className="lead">Três gestos, nada para instalar.</p>
          </div>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li className="step" key={step.title}>
                <span className="step-num tabular" aria-hidden>{i + 1}</span>
                <div>
                  <h3><step.icon size={20} aria-hidden /> {step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="container" aria-labelledby="relampago">
          <div className="flash">
            <div>
              <h2 id="relampago" className="flash-title"><Zap size={26} aria-hidden /> Missão Relâmpago</h2>
              <p className="flash-quote">“Compre uma peça de roupa até as 18h: pontos em dobro.”</p>
              <p>
                Desafios surpresa, sem marca definida. Compre em qualquer loja do shopping, escaneie o QR Code do seu
                cupom fiscal e pronto.
              </p>
            </div>
            <div className="flash-timer">
              <span className="countdown-label">Termina em</span>
              <Countdown untilHour={18} />
            </div>
          </div>
        </section>

        <section className="section container" id="premios">
          <div className="section-intro">
            <h2>Quanto mais você vem, mais você ganha</h2>
            <p className="lead">Seus pontos históricos nunca diminuem: cada visita te aproxima do próximo nível.</p>
          </div>
          <ol className="ladder">
            {TIERS.map((tier, i) => (
              <li className="rung" key={tier}>
                <span className={`tier-dot tier-${tier}`} aria-hidden>{TIER_INFO[tier].initial}</span>
                <strong>{TIER_INFO[tier].label}</strong>
                <span className="tier-min tabular">
                  {i === 0 ? "desde o primeiro scan" : `a partir de ${fmt(TIER_THRESHOLDS[tier])} pts`}
                </span>
                <p>{TIER_INFO[tier].perk}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="container" id="lojistas">
          <div className="panel-block merchant">
            <div className="merchant-pitch">
              <h2>Leve mais gente para a sua loja, sem instalar nada.</h2>
              <p className="lead">
                Para lojistas e shoppings: o Growlithe transforma passeio em visita, visita em venda e cada scan em dado.
              </p>
              <div className="actions">
                <a className="btn" href="#lista-de-espera">Quero minha loja no Growlithe</a>
                <a className="btn btn-secondary" href="#lista-de-espera">Agendar demonstração</a>
              </div>
            </div>
            <ul className="merchant-points">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <f.icon size={22} aria-hidden />
                  <div>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section container">
          <h2 className="centered">Perguntas frequentes</h2>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <Plus size={18} aria-hidden />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container" id="lista-de-espera">
          <div className="panel-block waitlist">
            <h2>Entre na lista de espera</h2>
            <p className="lead">Avisamos quando o Growlithe chegar ao seu shopping.</p>
            <WaitlistForm utm={utm} />
          </div>
        </section>
      </main>

      <footer className="container footer">
        <span>Growlithe · Time 26 · Desafio 05: Engajamento e fidelização dos visitantes</span>
        <span>Missões que fazem você voltar ao shopping.</span>
      </footer>
    </>
  );
}
