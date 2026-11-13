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

| Ordem | Spec | Entrega mínima | Critérios que mais pesa |
|---|---|---|---|
| 0 | — | Merge da base (`chore/base-nextjs`) + deploy na Vercel + Supabase conectado | Qualidade |
| 1 | 002 · Landing page | Formulário da lista de espera gravando leads com variante e UTM | Pitch, roleta |
| 2 | 003 · Check-in e missão por QR | Login por link mágico, scan de QR assinado, pontos creditados uma única vez, Home com saldo e nível | Problema, Qualidade, UX |
| 3 | 004 · Resgate | Catálogo com 2–3 prêmios, cupom de resgate de 6 dígitos, tela do lojista para validar | Problema, UX |
| 4 | 001 · Missão Relâmpago | Validação local pela chave do cupom fiscal (sem SEFAZ) | Inovação |
| 5 | — | Painel admin mínimo (criar missão, imprimir QR) | Viabilidade |

Se às 9h do dia 14 os itens 0–2 não estiverem prontos, **congelar o escopo** e polir o que existe. Um fluxo curto funcionando vale mais que cinco telas pela metade.

## Pitch de 90 segundos (rascunho)

1. **0–15s · Problema:** quem vai ao Capim Dourado compra e vai embora; o shopping não sabe quem voltou.
2. **15–55s · Demo:** escanear QR → pontos → nível → prêmio; Missão Relâmpago com o cupom fiscal.
3. **55–75s · Por que funciona:** sem app para instalar, sem integração com lojistas, dados de circulação para o shopping.
4. **75–90s · Prova:** números da landing page (cadastros, vencedor do A/B) e chamada final.

Gravar até 12h30 do dia 14 para ter margem até as 13h.
