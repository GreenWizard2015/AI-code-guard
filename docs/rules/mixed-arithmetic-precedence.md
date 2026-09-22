# `mixed-arithmetic-precedence`

Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, and `/` in one ungrouped expression.

## Bad

```ts
const total = first + second / third;
const delta = first + second - third;
```

```py
total = first + second / third
delta = first + second - third
```

## Good

```ts
const total = first + (second / third);
```

```py
total = first + (second / third)
```
