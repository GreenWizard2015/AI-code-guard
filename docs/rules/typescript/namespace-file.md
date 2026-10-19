# `namespace-file`

Description: A TypeScript file containing a namespace must contain exactly one namespace declaration. Outside that namespace, only static imports are allowed.

Keep classes, functions, values, and nested ownership inside the namespace so the file has one explicit boundary. The normal TypeScript rules still traverse and validate every declaration inside the namespace.

## Bad

```ts
namespace StatusModel {
	export interface StatusContract { label(): string; }
}
const item_count = 1;
```

## Good

```ts
namespace StatusModel {
}
```
