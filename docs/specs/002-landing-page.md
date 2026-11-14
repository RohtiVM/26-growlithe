# Spec 002 · Landing page com teste A/B de manchete

> Status: **parcialmente implementada** · ⚠️ Registrada **depois** da implementação da base (branch `chore/base-nextjs`), que foi feita antes de adotarmos o fluxo à risca. Daqui em diante, spec primeiro. Origem das decisões: `docs/07-pratica-sorteada-landing-page.md`.

## Problema

Precisamos provar com dados que as pessoas querem o Growlithe (prática sorteada: **Landing page**), e a banca precisa conseguir se cadastrar ao vivo pelo QR do slide.

## Solução

Página na rota `/` do mesmo projeto Next.js, com os dois temas, três públicos (visitante, lojista, shopping), teste A/B de manchete e formulário de lista de espera que grava um **Lead** com variante e UTM.

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Projeto separado ou o mesmo app? | Mesmo projeto, rota `/`, mesmos temas |
| D2 | Como sortear a variante? | 50/50 no primeiro acesso, fixada por cookie (`gl_ab_headline`, 30 dias) no middleware |
| D3 | Manchetes | A: "Seu passeio no shopping agora vale prêmios." · B: "Ganhe estacionamento grátis só por passear." |
| D4 | Um formulário ou três? | Um só, com o campo `profile` (`visitante` · `lojista` · `shopping`) |
| D5 | O que o formulário valida? | `JoinWaitlistInput` (Zod); aceite LGPD obrigatório |
| D6 | De onde vêm variante e UTM do Lead? | O servidor lê do cookie e da URL; o cliente não escolhe. Variante: só do cookie, na Server Action. UTM: a página lê da URL no servidor, repassa em campo oculto e a Server Action revalida com `Utm` (valor inválido vira `null`, nunca bloqueia o cadastro) |

## Critérios de aceite

1. ✅ Rota `/` renderiza as seções da doc 07 nos temas escuro e claro, sem rolagem horizontal a 375px.
2. ✅ No primeiro acesso a variante é sorteada e fixada em cookie; acessos seguintes mostram a mesma manchete.
3. ✅ Cookie com valor desconhecido é tratado como ausente.
4. ✅ Formulário valida com `JoinWaitlistInput` e mostra o erro em cada campo.
5. ✅ Envio válido grava um `LandingLead` com `variant` e `utm` lidos pelo servidor.
6. ✅ O mesmo e-mail não cria dois leads (sem diferenciar maiúsculas; o segundo envio mostra "você já está na lista").
7. ⬜ Métricas: conversão por variante e por público visíveis no painel.

## Fora do escopo

- Painel de métricas completo (vai para a spec do painel do shopping).

## Tickets (`/to-tickets`)

| # | Ticket | Depende de | Status |
|---|---|---|---|
| T1 | Base Next.js + temas + CI verde | — | ✅ |
| T2 | Landing estática + A/B por cookie | T1 | ✅ |
| T3 | Tabela `landing_leads` (Supabase) com `UNIQUE(email)` | — | ✅ `20261114110000_lista_de_espera.sql` |
| T4 | Server Action `joinWaitlist` + formulário | T2, T3 | ✅ `src/landing/waitlist*.ts(x)` |
| T5 | Consulta de conversão por variante | T3 | ⬜ |
