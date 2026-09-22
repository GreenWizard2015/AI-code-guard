# `unbounded-type`

**Purpose:** Do not use `any` or `unknown` in TypeScript, or `Any` in Python. The rule applies to
all type annotations recognized by the AST, including parameters, fields, return values, and
generic type positions.

**Bad:**

```ts
function read_value(value: unknown): any {
	return value;
}
```

```py
def read_value(value: Any) -> Any:
    return value
```

**Fix:** Replace the unbounded type with a concrete domain type or focused protocol.
