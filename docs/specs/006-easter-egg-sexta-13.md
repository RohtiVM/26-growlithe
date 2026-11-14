# Spec 006 · Easter egg de sexta-feira 13 (gatilhos de horário e clima)

> Status: **aprovada para implementação** · Origem: ideia do time (13/11, missão do easter egg). Decisões D3–D7 tomadas durante a madrugada, enquanto o time dormia — **revisar de manhã** (⚠️).

## Problema

A missão de sexta-feira 13 pede um easter egg. A ideia do time: o app reage ao mundo real, com dados simples, para parecer vivo e criar um momento que a pessoa mostra para os amigos.

## Solução

Dois gatilhos sensoriais, no app do visitante e na landing:

- **Madrugada (00h00–05h59, horário de Palmas):** o mascote aparece dormindo de pijama com a mensagem "O shopping está descansando para te receber amanhã… Vai dormir também!".
- **Chuva forte em Palmas:** gotas escorrem pela tela e o app destaca lojas com guarda-chuvas e capas (vestuário) e bebidas quentes (alimentação).

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Gatilho de horário | 00h00–05h59 em `America/Araguaina` |
| D2 | Gatilho de clima | Chuva forte na localização do shopping |
| D3 ⚠️ | Qual mascote | Original: uma chaminha (a marca 🔥) de touca e pijama. Não usamos o Pokémon Growlithe (personagem protegido) |
| D4 ⚠️ | API de clima | Open-Meteo (gratuita, sem chave, nenhum dado do visitante é enviado). Cache de 10 min no servidor; se falhar, não há efeito |
| D5 ⚠️ | O que é "chovendo muito" | Precipitação ≥ 2,5 mm/h **ou** código de chuva forte/tempestade (63, 65, 81, 82, 95, 96, 99) |
| D6 ⚠️ | "Mapa" do app | O app ainda não tem mapa: a chuva aparece na Home e no topo da landing, e o destaque vira um card com as lojas das categorias vestuário e alimentação |
| D7 ⚠️ | Demonstrar no pitch | `?easter=noite` e `?easter=chuva` forçam o efeito (o pitch é às 17h e pode não chover) |
| D8 | Se os dois valerem | A madrugada tem prioridade |
| D9 | Movimento | Gotas e entrada do mascote respeitam `prefers-reduced-motion` (sem animação, só a cena) |

## Critérios de aceite

1. **Dado** 02h00 em Palmas, **quando** o visitante abre o app ou a landing, **então** vê o mascote dormindo e a mensagem.
2. **Dado** 06h00 ou mais, **então** o mascote não aparece.
3. **Dado** chuva forte segundo a API, **então** gotas escorrem e o card destaca lojas de vestuário e alimentação.
4. **Dado** que a API falhou ou demorou mais de 2,5 s, **então** a página abre normalmente, sem efeito e sem erro.
5. **Dado** `?easter=noite` ou `?easter=chuva`, **então** o efeito aparece em qualquer horário e clima.
6. **Dado** o mascote na tela, **quando** a pessoa toca em "Até amanhã", **então** ele some e não volta nesta sessão.
7. **Dado** "reduzir movimento" ligado, **então** nada se move, mas a cena continua visível.

## Tickets

| # | Ticket |
|---|---|
| T1 | Regras puras (`resolveEasterEgg`, `isHeavyRain`, horário de Palmas) + testes |
| T2 | Busca do clima (Open-Meteo) com validação Zod, timeout e cache |
| T3 | Mascote dormindo (SVG original) e chuva (gotas + card de lojas) na Home e na landing |
