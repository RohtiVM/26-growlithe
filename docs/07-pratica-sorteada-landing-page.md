# 07 · Prática Sorteada: **Landing Page**

> Eixo sorteado: **Testes, métricas e lançamento → 2. Landing page** (página de apresentação do produto).

## Objetivo

A landing page do Growlithe não é só uma vitrine: ela é o **primeiro experimento do produto**. Ela responde, com dados, à pergunta que a banca vai fazer: *"as pessoas querem isso?"*

Ela tem três públicos, com uma chamada para ação (CTA) para cada:

| Público | Mensagem | CTA |
|---|---|---|
| **Visitante** | "Seu passeio no shopping agora vale prêmios." | **Entrar na lista de espera** |
| **Lojista** | "Leve mais gente para sua loja, sem instalar nada." | **Quero minha loja no Growlithe** |
| **Shopping** | "Saiba quem visita, quando volta e o que funciona." | **Agendar demonstração** |

Os três CTAs alimentam o mesmo formulário, com o campo `profile` (`visitante` · `lojista` · `shopping`).

## Estrutura da página

> 🎨 Versão visual: artboard **09 · Landing page** em [https://claude.ai/artifact/8nLcM6mxjsQEm2uV5QB1ae](https://claude.ai/artifact/8nLcM6mxjsQEm2uV5QB1ae). Ela tem um controle de "Teste A/B" que alterna as duas manchetes.

### Wireframe em texto

```
┌──────────────────────────────────────────────────────────────┐
│ 🔥 Growlithe                 Como funciona  Lojistas  [Entrar]│
├──────────────────────────────────────────────────────────────┤
│  HERO                                                         │
│  Seu passeio no shopping                ┌────────────┐        │
│  agora vale prêmios.                    │  mockup do  │        │
│  Escaneie, complete missões e troque    │  celular:   │        │
│  pontos por estacionamento, descontos   │  Home com   │        │
│  e experiências.                        │  pontos e   │        │
│  [ Entrar na lista de espera ]          │  missões    │        │
│  ⭐ 1.240 pessoas já na fila             └────────────┘        │
├──────────────────────────────────────────────────────────────┤
│  COMO FUNCIONA (3 passos)                                     │
│  📷 Escaneie   →   🎯 Complete missões   →   🎁 Ganhe prêmios  │
├──────────────────────────────────────────────────────────────┤
│  ⚡ MISSÃO RELÂMPAGO                                           │
│  "Compre uma peça de roupa até as 18h: pontos em dobro."      │
│  Escaneie o QR do seu cupom fiscal e pronto. Vale em qualquer │
│  loja do shopping.                                            │
├──────────────────────────────────────────────────────────────┤
│  NÍVEIS E PRÊMIOS                                             │
│  🥉 Bronze  🥈 Prata  🥇 Ouro  💎 Diamante (cards com exemplo) │
├──────────────────────────────────────────────────────────────┤
│  PARA LOJISTAS E SHOPPINGS                                    │
│  • Mais gente na porta  • Sem integração  • Dados em tempo real│
│  [ Quero minha loja no Growlithe ]  [ Agendar demonstração ]  │
├──────────────────────────────────────────────────────────────┤
│  PERGUNTAS FREQUENTES                                         │
│  Preciso baixar app? Não, abre pelo navegador.                │
│  Meus dados ficam seguros? Sim, LGPD...                       │
├──────────────────────────────────────────────────────────────┤
│  FORMULÁRIO                                                   │
│  Nome [_____]  E-mail [_____]  Sou: (•)Visitante ( )Lojista ( )Shopping │
│  [☑] Aceito receber contato (LGPD)      [ Entrar na lista ]   │
├──────────────────────────────────────────────────────────────┤
│  rodapé · Time 26 Growlithe · política de privacidade         │
└──────────────────────────────────────────────────────────────┘
```

## Como se integra ao produto

- **Mesmo projeto Next.js**, em um *route group* separado: `src/app/(marketing)/page.tsx` na raiz `/`, e o app em `/app`. Um deploy, um domínio, o mesmo design system (Tailwind + shadcn/ui).
- **Mesmo modelo de dados**: o formulário usa `JoinWaitlistInput` (derivado de `LandingLead` com `pick`) e a mesma fábrica `defineAction` do app.
- **QR Code também aqui**: os cartazes no shopping têm um QR com `?utm_source=cartaz&utm_medium=qr&utm_campaign=ala-b`. Assim medimos qual ponto físico traz mais cadastros.
- **Na demo**: a banca escaneia o QR do slide, cai na landing page e se cadastra. O contador de "pessoas na fila" sobe ao vivo.

```ts
export const LandingLead = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Conta pra gente seu nome").max(80),
  email: z.string().email("Confira o e-mail"),
  profile: z.enum(["visitante", "lojista", "shopping"]),
  company: z.string().max(80).nullable(),
  variant: z.enum(["A", "B"]),                    // teste A/B
  utm: Utm,                                       // de onde veio
  consentLgpd: z.literal(true, { message: "Precisamos do seu aceite para entrar em contato" }),
  createdAt: z.coerce.date(),
});

/** O formulário só envia isto; variante, UTM, id e data o servidor preenche. */
export const JoinWaitlistInput = LandingLead.pick({
  name: true, email: true, profile: true, company: true, consentLgpd: true,
});
```

## Métricas (o "M" do eixo sorteado)

| Métrica | Definição | Meta | Ferramenta |
|---|---|---|---|
| **Taxa de conversão** | cadastros ÷ visitantes únicos | > 15% | Vercel Analytics (eventos) |
| **Conversão por público** | cadastros por `profile` | lojista > 5% | tabela `landing_leads` |
| **Origem** | cadastros por `utm_source` | QR físico > 30% do total | UTM no lead |
| **Rolagem** | % que chega à seção de prêmios | > 50% | evento `scroll_depth` |
| **CTR do hero** | cliques no CTA principal ÷ visitas | > 25% | evento `cta_click` |
| **Tempo de carregamento** | LCP no 4G | < 2,5 s | Lighthouse / Speed Insights |

Os eventos também são tipados: uma união discriminada impede enviar um evento com campos errados.

```ts
type LandingEvent =
  | { name: "cta_click"; cta: "hero" | "lojista" | "shopping" }
  | { name: "scroll_depth"; percent: 25 | 50 | 75 | 100 }
  | { name: "lead_created"; profile: LeadProfile; variant: "A" | "B" };

const track = (event: LandingEvent) => va.track(event.name, event); // @vercel/analytics
```

## Testes

| Tipo | O que testa | Como |
|---|---|---|
| **A/B de headline** | A: "Seu passeio no shopping agora vale prêmios" × B: "Ganhe estacionamento grátis só por passear" | Middleware do Next sorteia a variante e grava cookie; o lead guarda `variant` |
| **Formulário** | Validação, mensagens, envio | Vitest + o mesmo schema `JoinWaitlistInput` |
| **Acessibilidade e desempenho** | Contraste, foco, LCP | Lighthouse CI no GitHub Actions (nota mínima: 90) |
| **Teste com usuários** | 5 pessoas no shopping: "o que esse produto faz?" em até 5 s | Roteiro no `docs/specs` |

## Lançamento

1. **Dia 1:** landing page no ar em `growlithe.vercel.app`, com QR nos slides e cartazes.
2. **Durante o hackathon:** divulgação no WhatsApp e Instagram com UTMs diferentes.
3. **Pitch final:** mostrar o painel com conversão real, o vencedor do A/B e a origem dos cadastros. **Dado real de validação vale mais que qualquer slide.**
