# 04 · Linguagem de Programação: TypeScript

**Escolha:** TypeScript 5.x em modo `strict`, com **React** na interface, em **todas** as camadas: interface, servidor, scripts e validação.

**Por que React:** é a biblioteca de interface mais usada no mercado, o time já conhece JavaScript, e o mesmo código roda no navegador de qualquer celular. Usamos React com o framework **Next.js**, que adiciona rotas, renderização no servidor e Server Actions.

## Por que TypeScript

### 1. Uma linguagem, um modelo de dados, ponta a ponta
Front-end e back-end compartilham o mesmo arquivo `src/domain/schemas.ts`. Quando o back-end muda o formato de `Mission`, o front-end **para de compilar** no mesmo instante. Num hackathon, isso elimina a categoria de bug mais cara: o front esperando um campo que o back renomeou.

### 2. Type-safety que também existe em runtime (Zod)
TypeScript sozinho some depois da compilação. Por isso usamos **Zod**: o schema valida o dado real (QR Code escaneado, formulário, linha do banco) e o tipo é **inferido** do schema. Um schema, duas garantias:

```ts
export const QrPayload = z.object({ v: z.literal(1), cp: CheckpointId, exp: z.number().int(), sig: z.string().min(32) });
export type QrPayload = z.infer<typeof QrPayload>; // tipo derivado, nunca escrito à mão
```

### 3. O compilador como membro do time
Com uniões discriminadas e `assertNever`, o compilador aponta **todos os lugares** que precisam mudar quando surge um tipo novo de missão ou de recompensa. É um checklist automático, sem depender de alguém lembrar.

### 4. Produtividade (DX)
- **Autocomplete perfeito**: `defineAction(ScanQrInput, async (input) => ...)` já sabe o tipo de `input` e de todos os erros possíveis.
- **Refatoração segura**: renomear um campo no VS Code atualiza tudo.
- **Ecossistema**: Next.js, Supabase, shadcn/ui e Zod são TypeScript-first. Não precisamos escrever tipos para bibliotecas.

### 5. Curva de aprendizado
Todo o time já conhece JavaScript. TypeScript é JavaScript com tipos: a barreira de entrada é quase zero e cada integrante produz desde a primeira hora.

## Configuração (o "strict de verdade")

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,     // arr[0] é T | undefined — sem crash por índice
    "exactOptionalPropertyTypes": true,   // `x?: string` não aceita `undefined` explícito
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true          // `import type` explícito
  }
}
```

ESLint (`@typescript-eslint`):

```jsonc
{
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-assertions": ["error", { "assertionStyle": "never" }],
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/no-floating-promises": "error"
}
```

`as const` e `satisfies` continuam permitidos: eles **restringem** tipos, nunca mentem para o compilador.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| JavaScript puro | Sem garantia de contrato entre front e back; bugs aparecem só na demo. |
| Python (FastAPI) + React | Duas linguagens e dois modelos de dados para manter sincronizados (Pydantic e TS). Dobra o trabalho em 48 h. |
| Dart (Flutter) | Ótimo em mobile, mas exige loja de apps ou build nativo; o time tem mais experiência em web. |
| Kotlin (Android nativo) | Exige instalação pela Play Store (reduz o alcance), só atende Android e o time precisaria aprender a linguagem no prazo. |
| React Native | Também exige instalar um app. O web app em React atinge mais gente com o mesmo conhecimento. |
| Kotlin/Swift nativo | Duas bases de código; inviável no prazo. |
