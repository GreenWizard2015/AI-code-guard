# `mixed-boolean-precedence`

Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`.

## Bad

```ts
const ready = first && second || third;
```

```py
ready = first and second or third
```

## Good

```ts
const ready = first && (second || third);
```

```py
ready = first and (second or third)
```
