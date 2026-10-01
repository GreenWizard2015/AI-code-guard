# `mixed-boolean-precedence`

Split a boolean expression or add parentheses when it mixes `&&`, `||`, and `!` in one ungrouped expression. The Python equivalents are `and`, `or`, and `not`. Also group negation before a comparison when its scope is not explicit.

## Bad

```ts
const ready = first && second || third;
const has_items = first || second || count > 0;
const different = !value === expected;
```

```py
ready = first and second or third
has_items = first or second or count > 0
different = not value == expected
```

## Good

```ts
const ready = first && (second || third);
const different = !(value === expected);
```

```py
ready = first and (second or third)
different = not (value == expected)
```
