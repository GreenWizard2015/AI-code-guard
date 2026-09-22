# `typescript-index-signature`

**Purpose:** Do not use open-ended TypeScript index signatures in interfaces or object types.

**Bad:**

```ts
type RuntimeRecord = {
	[key: string]: string;
};
```

**Fix:** Replace the unbounded key space with a named contract and explicit behavior, or define
the permitted keys explicitly.

```ts
interface RuntimeRecord {
	value(name: RuntimeFieldName): string;
}
```
