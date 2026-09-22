# `typescript-unknown-parameter-type`

**Purpose:** Do not accept TypeScript `unknown` as a parameter type.

**Bad:**

```ts
function parse_value(value: unknown): ParsedValue {
	return parse(value);
}
```

**Fix:** Define the concrete input contract or a focused protocol at the boundary.

```ts
function parse_value(value: SerializedValue): ParsedValue {
	return parse(value);
}
```
