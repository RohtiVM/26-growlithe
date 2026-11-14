# Spec 008 · Modo avaliador

> Status: **aprovada para implementação** · Origem: pedido do Vithor (14/11, manhã), para a banca do HackaRun testar o MVP no próprio celular.

## Problema

Os avaliadores precisam experimentar o Growlithe na prática: escanear um QR, ganhar pontos, completar uma missão e ver o painel do shopping. Hoje o login depende de um e-mail que o Supabase só entrega para a equipe do projeto, e o painel só abre para quem recebeu o papel de admin.

## Solução

Um botão **"Entrar como avaliador"** cria uma sessão anônima (sem e-mail) e dá à conta o papel de admin por tempo limitado. O guia dos avaliadores traz dois QR Codes de uma "Caça ao tesouro do avaliador".

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Como entram sem e-mail | Login anônimo do Supabase (`signInAnonymously`) |
| D2 | O avaliador vê o painel? | Sim: a conta anônima vira **admin** ao entrar pelo modo avaliador |
| D3 | Até quando | **15/11/2026 às 23h59 (Palmas)**. Depois disso o papel deixa de valer sozinho, no banco e no app, e o botão some |
| D4 | Quem pode virar admin assim | Só sessões anônimas, só dentro do prazo, e só se a conta ainda não tem papel |
| D5 | Nome | "Avaliador(a)" por padrão, para não travar a demo |
| D6 | Mini missão | "Caça ao tesouro do avaliador": QR da Entrada (check-in) e depois QR da Praça de alimentação, Missão Relâmpago ×2 |

## Critérios de aceite

1. **Dado** o QR do guia, **quando** o avaliador toca em "Entrar como avaliador", **então** ganha os pontos do scan sem informar e-mail.
2. **Dado** que escaneou a Entrada e depois a Praça, **então** a caça ao tesouro aparece como concluída, com os pontos em dobro.
3. **Dado** uma conta de avaliador dentro do prazo, **quando** abre `/painel`, **então** vê o painel do admin.
4. **Dado** que o prazo passou, **então** o papel de admin do avaliador não vale mais (banco e app) e o botão não aparece.
5. **Dado** uma conta com e-mail (não anônima), **quando** chama a função do modo avaliador, **então** nada muda.

## Tickets

| # | Ticket |
|---|---|
| T1 | Banco: prazo do modo avaliador, `claim_evaluator_access()` e `staff_role()` respeitando o prazo + testes |
| T2 | Botão "Entrar como avaliador" no scan, no login do visitante e no login do painel |
| T3 | Missão de demonstração e QR Codes no guia (README e resumo) |
