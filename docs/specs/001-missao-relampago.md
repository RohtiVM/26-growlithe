# Spec 001 · Missão Relâmpago validada por cupom fiscal

> Formato de saída do `/to-spec`. Status: **aprovada para implementação** · Origem: sessão de `/grill-with-docs` do time.

## Problema

O shopping quer gerar venda em categorias de lojas com movimento fraco num horário específico, sem depender de integração com o sistema de cada lojista.

## Solução

O admin lança uma **Missão Relâmpago** genérica ("compre uma peça de roupa até as 18h"). O visitante compra em **qualquer** loja da categoria e escaneia o QR Code do cupom fiscal (NFC-e) para ganhar pontos multiplicados.

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Como provar a compra sem integrar lojas? | QR Code da NFC-e, que toda loja já imprime |
| D2 | Como saber a categoria? | MVP: pela categoria da loja (CNPJ → `stores.category`). Depois: pelos itens via SEFAZ |
| D3 | Um cupom pode ser usado por duas pessoas? | Não. `UNIQUE` global no hash da chave |
| D4 | E se a consulta à SEFAZ cair? | Cai para a validação local (só a chave); o visitante não percebe |
| D5 | Missão relâmpago tem valor mínimo? | Opcional. Só é checado quando a SEFAZ responde |
| D6 | Guardamos o cupom? | Não. Só o hash da chave, loja, valor e horário (LGPD) |
| D7 | Como o visitante fica sabendo? | Push no lançamento + card com contagem regressiva na Home |

## Critérios de aceite

1. Admin cria missão com `requirement.kind = "purchase_category"` e `launch.type = "flash"`; o formulário recusa `endsAt` antes de `startsAt`.
2. Ao criar, todos os visitantes com push ativo recebem `launch.pushTitle` e `launch.pushBody`.
3. O visitante escaneia o QR do cupom; QR que não é de NFC-e mostra `invalid_receipt`.
4. CNPJ que não está em `stores` → `store_not_in_mall`.
5. Loja de outra categoria → `wrong_category`.
6. Cupom já usado (por qualquer pessoa) → `receipt_already_used`.
7. Cupom fora da janela da missão → `receipt_outside_window` (por mês no modo local; por data e hora no modo SEFAZ).
8. Sucesso: credita `pointsReward × pointsMultiplier`, atualiza o progresso e mostra a loja reconhecida.
9. Duas requisições simultâneas com o mesmo cupom creditam pontos **uma única vez**.

## Fora do escopo

- Validar o item exato comprado (vai para a spec 002).
- Missão em loja específica com valor mínimo (`purchase`).

## Tickets (`/to-tickets`)

| # | Ticket | Depende de |
|---|---|---|
| T1 | Tabelas `stores` e `receipts` + seed das lojas do shopping | — |
| T2 | Schemas `NfceQrUrl`, `MissionLaunch`, `purchase_category` + testes | — |
| T3 | `ReceiptVerifier`: adaptador local + `withFallback` | T2 |
| T4 | Função Postgres `award_receipt` (transação + `UNIQUE`) | T1 |
| T5 | Server Action `scanReceipt` | T3, T4 |
| T6 | Telas: card da Missão Relâmpago + resultado do scan | T5 |
| T7 | Painel admin: lançar missão relâmpago + envio de push | T2 |
| T8 | Adaptador Infosimples + conferência com cupom real | T3 |
