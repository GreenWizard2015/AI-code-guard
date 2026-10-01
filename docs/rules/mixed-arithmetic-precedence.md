# `mixed-arithmetic-precedence`

Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, `/`, `%`, `//`, and `**` in one ungrouped expression. Parentheses around a larger expression do not hide a mixed expression inside that group.

## Bad

```ts
const total = first + second / third;
const delta = first + second - third;
const remainder = first + second % third;
const power = first * second ** third;
```

```py
total = first + second / third
delta = first + second - third
remainder = first + second % third
floor = first // second - third
```

## Good

```ts
const total = first + (second / third);
const power = first * (second ** third);
```

```py
total = first + (second / third)
floor = (first // second) - third
```
