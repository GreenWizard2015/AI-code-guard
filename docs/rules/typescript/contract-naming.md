# contract-naming

Description: TypeScript interfaces must end with `Contract`. Contract names must
also be domain names: they must not contain `Prot`, `Proto`, `Protocol`, or
`Interface`, in any casing or position.

Examples: `RuleContract`, `SourceNamesContract`, and `UserRepositoryContract`.
Avoid names such as `RuleProtocolContract`, `UserProtContract`, or `UserInterfaceContract`.

## Bad

```ts
// File: src/protocols.ts
export interface ReaderProtContract {
	consume_content(): string;
}
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

