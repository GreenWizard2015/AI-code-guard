# `interface-shape`

Description: Use an interface for a behavior contract instead of a callable-heavy alias or namespace-shaped object.

## Bad

```ts
// File: src/types.ts
export type UserOperations = {
	load(): string;
	save(value: string): void;
	close(): void;
	refresh(): void;
};
```

## Good

```ts
// File: src/protocols.ts
export interface UserOperationsContract {
	load(): string;
	save(value: string): void;
}
export interface UserServiceContract {
	configure(operations: UserOperationsContract): void;
}
```
