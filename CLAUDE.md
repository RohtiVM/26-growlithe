# Growlithe — instruções para agentes

Leia antes de qualquer tarefa: `README.md`, `CONTEXT.md` (glossário) e `docs/10-processo-de-desenvolvimento.md`.

## Fluxo obrigatório: spec-driven development

Nenhum código de feature é escrito sem spec aprovada. O fluxo é:

1. **Alinhar** — `/grill-with-docs` (ou `/grilling`): entreviste o time até toda decisão fechar. Termos novos entram no `CONTEXT.md` antes de entrar no código.
2. **Especificar** — `/to-spec`: grave a spec em `docs/specs/NNN-<slug>.md` seguindo `docs/specs/000-template.md`.
3. **Fatiar** — `/to-tickets`: uma issue no GitHub por fatia vertical, com dependências.
4. **Implementar** — `/tdd`: um ticket por vez, teste primeiro, na branch `feat/<nº-da-issue>-<slug>`.
5. **Revisar** — `/code-review` nos dois eixos: padrões do repo e aderência à spec.
6. **Aprender** — `/retro` ao fim do dia.

Se pedirem para implementar algo sem spec, pare e proponha o passo 1.

## Regras da casa

- TypeScript `strict`. Zero `any`, zero `as` (o lint barra). Switch sempre exaustivo (`assertNever`).
- Todo tipo vem de um schema Zod em `src/domain/schemas.ts` (`z.infer`). Nunca escreva o tipo à mão.
- Toda entrada (form, QR, resposta externa, linha do banco) é validada com Zod na borda.
- Pontos só mudam no banco, numa função transacional. QR e cupom fiscal nunca pontuam duas vezes.
- LGPD: nunca guarde CPF. Do cupom fiscal, só hash da chave, loja, valor e horário.
- Use as palavras do `CONTEXT.md`: "cupom fiscal" ou "cupom de resgate", nunca "cupom" sozinho.
- Commits em Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Comandos

```bash
pnpm dev        # app em http://localhost:3000
pnpm typecheck  # inclui os testes de tipo
pnpm lint
pnpm test
pnpm build
```

O CI roda os quatro últimos em todo PR. PR só entra com CI verde.
