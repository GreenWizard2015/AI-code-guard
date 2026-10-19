# `empty-contract`

Description: A naming-only interface or protocol adds indirection without defining a useful
behavior boundary. Keep at least one meaningful operation that consumers need.

## Bad

```ts
// File: src/protocols.ts
export interface RepositoryContract {}
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _content access contract_. **/
export interface ReaderContract {
	/** Responsibilities: _content consumption_. **/
	consume_content(): string;
}
```

