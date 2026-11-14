# 11 · Plano rumo à entrega final (14/11)

> Fonte: vídeos oficiais "Manual HackaRun 2026" e "HackaRun 2026: Missão 1", e o recado do professor Sergio (13/11, 14h40): **spec-driven development com as skills do Matt Pocock é mandatório**.

## O que o evento exige

| Quando | O quê | Status |
|---|---|---|
| 13/11 · 12h | Entrega 1: telas, documentação, linguagem, arquitetura, plataformas e integração da roleta | ✅ entregue |
| 13/11 · tarde | Missões das três gemas, NPCs e easter egg de sexta-feira 13 | — |
| **14/11 · 12h** | **MVP final rodando** ("rodando liso") | ⬜ |
| **14/11 · 13h** | **Pitch em vídeo de 90 segundos** | ⬜ |
| 14/11 · 17h | HackaRun Experience no **Shopping Capim Dourado**: finalistas | — |

- O problema é real e é do **Shopping Capim Dourado** (Palmas, TO): o pitch e as telas devem falar dele.
- MVP = versão básica **funcional** que prove a ideia central. Não precisa estar 100% polida.
- A prática sorteada na roleta (**Landing page**) é **obrigatória** no projeto final.
- Mentores orientam, mas não escrevem código.

## Onde estão os pontos

| Critério | Peso | O que a banca precisa ver no Growlithe |
|---|---|---|
| Resolução do problema | 25 | Um visitante do Capim Dourado escaneia um QR, ganha pontos e vê um prêmio perto de liberar: motivo para voltar |
| Qualidade da implementação | 25 | Fluxo funcionando de ponta a ponta no celular, CI verde, testes, regras de antifraude (QR assinado, uso único) |
| Inovação e viabilidade | 20 | Missão Relâmpago validada pelo QR do cupom fiscal, sem integração com lojistas; custo zero para começar |
| Experiência do usuário | 15 | Abre pelo QR sem instalar nada; temas acessíveis (AA); feedback claro em cada scan |
| Apresentação e pitch | 15 | 90 segundos, demo ao vivo e a banca se cadastrando pela landing page |

## Ordem de entrega (o que cortar se o tempo apertar)

Cada item passa pelo fluxo da `docs/10`: **grill → spec → tickets → TDD → code-review**.

| Ordem | Spec | Entrega mínima | Critérios que mais pesa | Status (13/11, noite) |
|---|---|---|---|---|
| 0 | — | Merge da base (`chore/base-nextjs`) + deploy na Vercel + Supabase conectado | Qualidade | 🟡 base na `main`; faltam Vercel e aplicar a migration no Supabase |
| 1 | 002 · Landing page | Formulário da lista de espera gravando leads com variante e UTM | Pitch, roleta | 🟡 página e A/B prontos; falta o formulário |
| 2 | 004 · Check-in e missão por QR | Login por link mágico, scan de QR assinado, pontos creditados uma única vez, Home com saldo e nível | Problema, Qualidade, UX | 🟡 assinatura do QR pronta (spec 003 T4); spec 004 ainda não escrita |
| 3 | 005 · Resgate | Catálogo com 2–3 prêmios e geração do cupom de resgate de 6 dígitos (a validação está na spec 003) | Problema, UX | 🟡 recompensas no seed; spec ainda não escrita |
| 4 | 001 · Missão Relâmpago | Validação local pela chave do cupom fiscal (sem SEFAZ) | Inovação | ⬜ spec pronta; leitura da chave já testada |
| 5 | 003 · Painel (admin e lojista) | Checkpoints e QR (necessário para a demo do item 2), validar cupom de resgate, missões e dashboard | Viabilidade, Pitch | 🟡 T1, T2 e T4 prontos; próximos T3 e T5 |

Se às 9h do dia 14 os itens 0–2 não estiverem prontos, **congelar o escopo** e polir o que existe. Um fluxo curto funcionando vale mais que cinco telas pela metade.

## Pitch de 90 segundos (rascunho)

1. **0–15s · Problema:** quem vai ao Capim Dourado compra e vai embora; o shopping não sabe quem voltou.
2. **15–55s · Demo:** escanear QR → pontos → nível → prêmio; Missão Relâmpago com o cupom fiscal.
3. **55–75s · Por que funciona:** sem app para instalar, sem integração com lojistas, dados de circulação para o shopping.
4. **75–90s · Prova:** números da landing page (cadastros, vencedor do A/B) e chamada final.

Gravar até 12h30 do dia 14 para ter margem até as 13h.
