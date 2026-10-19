# `type-info`

Description: Prefer a concrete value contract or focused protocol over unbounded boundary types.

This applies to both languages. In TypeScript it includes `any`, `unknown`, and
`object`; in Python it includes `Any`, `typing.Any`, `typing_extensions.Any`,
`object`, and equivalent unbounded aliases. Use a concrete value type or a
focused protocol instead.

## Bad

```ts
// File: cli.ts
function parse(value): unknown { return value; }
(function () { const parsed = parse("ready"); })();
```


## Good

```ts
// File: cli.ts
function parse(value: string): string { return value; }
(function () { const parsed = parse("ready"); })();
```

