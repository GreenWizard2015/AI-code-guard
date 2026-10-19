# contract-naming

Description: All TypeScript interfaces and Python Protocols must end with `Contract`.
Contract names must also be domain names: they must not contain `Proto`,
`Protocol`, or `Interface`.

Examples: `RuleContract`, `SourceNamesContract`, and `UserRepositoryContract`.
Avoid names such as `RuleProtocolContract` or `UserInterfaceContract`.

## Bad

```ts
// File: src/protocols.ts
export interface ReaderInterface {
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

