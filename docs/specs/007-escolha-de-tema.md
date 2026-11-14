# Spec 007 · Botão de tema claro / escuro

> Status: **aprovada para implementação** · Origem: pedido do Vithor (14/11): "há pessoas que não gostam dessa tela preta e preferem o nosso outro tema".

## Problema

O app segue só o modo do celular. Quem usa o sistema no escuro não consegue ver o tema claro (cores do Tocantins), e vice-versa.

## Solução

Um botão sol/lua no cabeçalho da landing, do app do visitante e do painel alterna entre os dois temas. A escolha fica salva no aparelho; sem escolha, o app segue o modo do celular, como hoje.

## Decisões tomadas

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Quantos estados | Dois no botão (claro ↔ escuro). "Seguir o celular" é o padrão enquanto a pessoa não escolhe |
| D2 | Onde guardar | `localStorage` (`gl_tema`) — preferência do aparelho, não da conta; acesso protegido por try/catch |
| D3 | Sem "piscar" | Um script mínimo no `<head>` aplica `data-theme` antes de a página aparecer |
| D4 | Animação na troca | Nenhuma: troca instantânea (ação repetida; animar todas as cores custa caro) |
| D5 | Onde fica o botão | Cabeçalho da landing, do app do visitante e do painel |

## Critérios de aceite

1. **Dado** um celular no modo escuro, **quando** a pessoa toca no botão, **então** a página muda para o tema claro (Tocantins) na hora.
2. **Dado** que ela escolheu o tema claro, **quando** recarrega ou abre outra página, **então** continua no claro, sem piscar o escuro antes.
3. **Dado** que ela nunca escolheu, **então** o app segue o modo do celular.
4. **Dado** armazenamento bloqueado (aba anônima), **então** o botão ainda troca o tema na página aberta, sem erro.
5. O botão tem rótulo acessível que diz o que ele faz ("Usar tema claro" / "Usar tema escuro") e 44px de área de toque.

## Tickets

| # | Ticket |
|---|---|
| T1 | Regras puras (tema efetivo, próximo tema, leitura segura do valor salvo) + testes |
| T2 | CSS por `data-theme`, script anti-piscar e botão nos três cabeçalhos |
