# `typescript-type-assertion`

Do not silence the TypeScript checker with explicit type assertions.

```ts
const value = input as Result;
const other = <Result>input;
```

Validate external data at its boundary, use an AST/type predicate, or change
the contract so the compiler can prove the type. `as const` is a literal
inference declaration, not a runtime type cast, and is not reported by this
rule.

As an alternative to an assertion, use one `typeof` check at the external input
boundary and return the explicit domain type. Do not repeat the check in business
logic.
