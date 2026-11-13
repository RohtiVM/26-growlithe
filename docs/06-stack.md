# 06 · Plataforma e Tecnologias Adotadas

**Decisão de plataforma:** web app em React, sem instalação. Orientação do mentor: pedir para as pessoas instalarem um aplicativo derruba o alcance.

**Critério de escolha:** cada peça precisa ser *TypeScript-first* (tipos de primeira classe, sem `@types` de terceiros), ter tier gratuito e permitir ir do zero ao deploy em minutos.

## Plataforma

| Camada | Plataforma | Por quê |
|---|---|---|
| Cliente | **Web app** no navegador do celular | Sem instalação (maior alcance, orientação do mentor). Câmera e QR funcionam no navegador; o visitante entra pelo próprio QR |
| Hospedagem | **Vercel** | Deploy a cada push, preview por PR, integração nativa com Next.js |
| Backend-as-a-Service | **Supabase** | Postgres gerenciado + Auth + RLS + Realtime + geração de tipos TS |

## Stack

| Categoria | Tecnologia | Papel no Growlithe |
|---|---|---|
| Linguagem | **TypeScript 5 (strict)** | Tudo. Ver [`04-linguagem.md`](04-linguagem.md) |
| Validação e tipos | **Zod** | Fonte única da verdade: schemas → tipos → validação de borda |
| Biblioteca de UI | **React 19** | Componentes da interface (visitante, admin e landing page) |
| Framework React | **Next.js 15 (App Router)** | Rotas, Server Components e Server Actions sobre o React; deploy direto na Vercel |
| UI | **Tailwind CSS** + **shadcn/ui** (Radix) | Componentes acessíveis, copiados para o repo (sem lock-in) |
| Temas | **next-themes** + variáveis CSS de [`src/ui/theme.ts`](../src/ui/theme.ts) | Tema escuro (vermelho/preto/branco) e claro (Tocantins); segue o celular por padrão |
| Formulários | **react-hook-form** + `@hookform/resolvers/zod` | O mesmo schema do servidor valida o cliente |
| Banco | **Supabase Postgres** | Tabelas, RLS, funções `award_points` e `reserve_reward` |
| Auth | **Supabase Auth** (link mágico por e-mail) | Sem senha: menos atrito para o Seu Carlos |
| Tempo real | **Supabase Realtime** | Cupom muda para "Usado" sem recarregar |
| Tipos do banco | `supabase gen types typescript` | `Database` tipado para os repositórios |
| QR — leitura | **`@zxing/browser`** (ou `BarcodeDetector` nativo, quando disponível) | Scanner na câmera do navegador |
| QR — geração | **`qrcode`** | Gera SVG/PNG no painel admin para imprimir |
| Assinatura do QR | **Web Crypto (HMAC-SHA256)** nativo | Sem dependência; roda no Node e no Edge |
| Ícones | **lucide-react** | Consistente com shadcn/ui |
| Qualidade | **ESLint** (`typescript-eslint`), **Prettier** | Barra `any` e `as`, exige switch exaustivo |
| Testes | **Vitest** + testes de tipo (`@ts-expect-error`) | Regras puras (níveis, progresso) e garantias do compilador |
| Gerenciador | **pnpm** | Instalação rápida |
| Cupom fiscal | **Infosimples — API SEFAZ/NFC-e** | Data, valor e itens da compra; fallback local. Ver [`09-integracao-sefaz.md`](09-integracao-sefaz.md) |
| Métricas da landing | **Vercel Analytics** + **Speed Insights** | Conversão, eventos tipados, LCP |
| CI | **GitHub Actions** | Typecheck, lint, testes e build em todo PR |
| Processo | **`mattpocock/skills`** | grill → spec → tickets → implement. Ver [`10-processo-de-desenvolvimento.md`](10-processo-de-desenvolvimento.md) |

## Variáveis de ambiente (validadas com Zod também)

```ts
// src/env.ts
import { z } from "zod";

const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  QR_SIGNING_SECRET: z.string().min(32, "Use pelo menos 32 caracteres"),
  // Opcionais: sem eles, o cupom fiscal é validado só localmente
  INFOSIMPLES_TOKEN: z.string().min(1).optional(),
  INFOSIMPLES_NFCE_URL: z.string().url().optional(),
});

export const env = Env.parse(process.env); // app nem sobe com env faltando
```

## Custo

Tudo no tier gratuito durante o hackathon: Vercel Hobby, Supabase Free (500 MB de banco, 50 mil usuários ativos por mês no Auth). **Custo zero** para o MVP e o piloto.

## Divisão de trabalho sugerida (paralelismo pelo contrato)

Como o contrato (`schemas.ts`) fica pronto primeiro, o time trabalha em paralelo sem se bloquear:

| Trilha | Começa com | Depende de |
|---|---|---|
| UI do visitante | Dados mockados que passam no `Mission.parse` | Só do `schemas.ts` |
| UI admin | `CreateMissionInput` + `zodResolver` | Só do `schemas.ts` |
| Back-end | Migrações + `award_points` + Server Actions | Só do `schemas.ts` |
| QR | Assinatura e verificação HMAC + página de impressão | `QrPayload` |
