# Spec 004 · Check-in e missão por QR Code

> Formato de saída do `/to-spec`. Status: **aprovada para implementação** · Origem: grill de 14/11 (madrugada).
> Rodada 1 (D1–D8) confirmada pelo Vithor. Rodada 2 (D9–D15) seguiu as recomendações enquanto o time dormia — **revisar de manhã** (marcadas com ⚠️).

## Problema

É o coração do Growlithe e da demo: o visitante do Shopping Capim Dourado aponta a câmera para um QR Code, ganha pontos na hora e vê que está perto de um prêmio. Sem isso, não há motivo para voltar (critério "Resolução do problema", 25 pts).

## Solução

A câmera nativa abre `/s/<token>`. O token (assinado no painel, T4/T5) é conferido **dentro do banco** pela função `scan_checkpoint`, que registra o scan, credita pontos base, avança as missões e devolve o resultado — tudo numa transação. O visitante entra por link mágico no próprio scan, informa o nome uma vez e cai na tela de resultado; a Home mostra saldo, nível, presença e missões.

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Visitante sem login escaneou | A página do scan pede o e-mail, envia o link mágico e guarda o token no retorno; ao clicar, os pontos são creditados |
| D2 | Scan fora de missão vale? | Sim: pontos base em todo scan válido, mais os da missão que ele completar |
| D3 | O que é check-in | Checkpoint marcado como entrada (`is_entrance`); escanear marca a presença do dia |
| D4 | O que é "um dia" | Horário de Palmas (`America/Araguaina`, UTC−3) |
| D5 | Bloquear com o shopping fechado | Não no MVP (`mall_closed` fica para o roadmap) |
| D6 | Missões que contam | `qr_scan` simples, caça ao tesouro (`ordered`) e `event_checkin` |
| D7 | Como escaneia | Câmera nativa do celular → link `/s/<token>`; scanner dentro do app fica para depois |
| D8 | Telas | Resultado do scan, Home e lista de Missões com progresso |
| D9 ⚠️ | Valor dos pontos base | 10 por scan; 20 no primeiro check-in de entrada do dia |
| D10 ⚠️ | Caça ao tesouro fora de ordem | Ganha os pontos base, mas a missão não avança ("essa é a pista 4; procure a 3") |
| D11 ⚠️ | Missão repetível | No MVP toda missão completa uma vez por visitante |
| D12 ⚠️ | Missão Relâmpago de scan | Credita `pointsReward × pointsMultiplier` |
| D13 ⚠️ | Nome do visitante | Pedido uma vez, logo após o primeiro login ("Como podemos te chamar?") |
| D14 ⚠️ | Endereços | `/s/<token>` (scan), `/app` (Home), `/app/missoes`, `/app/entrar`, `/app/nome` |
| D15 ⚠️ | Subiu de nível | A tela de resultado celebra ("Você subiu para Prata!") |
| D16 | Onde o QR é conferido | No banco (`pgcrypto`), com o segredo guardado em `private.app_secrets`. Assim ninguém ganha pontos chamando a API com um id de checkpoint |

## Critérios de aceite

1. **Dado** um QR válido e um visitante logado com nome, **quando** ele abre `/s/<token>`, **então** vê "+10 pts" (ou "+20 pts · check-in" na entrada) e o saldo novo.
2. **Dado** o mesmo QR escaneado de novo no mesmo dia (Palmas), **quando** abre o link, **então** vê "Você já escaneou este ponto hoje. Volte amanhã!" e nada é creditado.
3. **Dado** um token com assinatura alterada ou checkpoint trocado, **quando** abre o link, **então** vê "Esse QR Code não é do Growlithe." e nada é gravado.
4. **Dado** um token vencido, **quando** abre o link, **então** vê "Esse QR Code expirou. Peça um novo na loja."
5. **Dado** um visitante sem login, **quando** abre o link e pede o link mágico, **então** ao clicar no e-mail volta para o mesmo scan e recebe os pontos.
6. **Dado** um visitante sem nome, **quando** volta do link mágico, **então** informa o nome antes de ver o resultado.
7. **Dado** uma missão `qr_scan` ativa com 1 checkpoint, **quando** o visitante escaneia esse ponto, **então** a missão fica concluída e ele ganha os pontos dela (× multiplicador se for relâmpago).
8. **Dado** uma caça ao tesouro em ordem, **quando** ele escaneia a pista certa, **então** o progresso avança ("2 de 5"); fora de ordem, ganha os pontos base e vê qual pista procurar.
9. **Dado** que o scan fez os pontos históricos cruzarem um limiar, **então** a tela mostra "Você subiu para <nível>!".
10. **Dado** duas requisições simultâneas com o mesmo QR, **então** os pontos são creditados uma única vez.
11. **Dado** um check-in de entrada hoje, **quando** abre a Home, **então** vê "Você está no shopping" com o horário e o ponto.
12. **Dado** uma missão encerrada no painel, **quando** escaneia um ponto dela, **então** ela não avança (critério 12 da spec 003).

## Fora do escopo

- Scanner dentro do app, QR dinâmico do tablet, sequência de dias (`visit_streak`), bloqueio por horário, missões repetíveis.

## Tickets

| # | Ticket | Depende de |
|---|---|---|
| T1 | Banco: `is_entrance`, `scans`, `point_ledger`, `mission_progress`, `private.app_secrets` e função `scan_checkpoint` (HMAC no banco) + testes | — |
| T2 | Domínio: resultado do scan (Zod) e regras puras + testes | T1 |
| T3 | Login do visitante por link mágico, retorno para o scan e tela do nome | — |
| T4 | Tela `/s/<token>` (resultado, erros, subida de nível) | T1, T2, T3 |
| T5 | Home `/app` e `/app/missoes` | T1 |
