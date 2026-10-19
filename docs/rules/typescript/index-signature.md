# `index-signature`

Description: Do not use open-ended TypeScript index signatures in interfaces or object types.

## Bad

```ts
// File: src/protocols.ts
export interface RuntimeRecordContract {
	[key: string]: string;
}
```

**Fix:** Replace the unbounded key space with a named contract and explicit behavior, or define
the permitted keys explicitly.

## Good

```ts
// File: src/protocols.ts
export interface RuntimeRecordContract {
	value(name: string): string;
}
```
