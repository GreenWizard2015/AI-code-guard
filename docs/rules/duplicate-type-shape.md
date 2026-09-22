# Duplicate type shape

Detects different named TypeScript object types or Python classes whose sorted
field-and-type signatures and sorted base-type signatures have the same
SHA-256 hash.

The diagnostic lists every name in the duplicate group. The rule ignores empty
shapes and does not compare field declaration order. Python classes with
different native bases remain distinct even when their fields are identical.
TypeScript interfaces use their `extends` types as bases.

Bad:

```ts
type JsonResponse = { content: Record<string, unknown> };
type TextResponse = { content: { text: string } };
```

Good:

```ts
interface ResponseContent {
	content: Record<string, unknown>;
}
```
