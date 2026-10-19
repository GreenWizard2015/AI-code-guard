# `callback-contract-size`

Description: Keep callback contracts to three or fewer parameters. A named TypeScript function
type or callback field, and a Python `Callable` parameter, is reported when it
accepts more than three values. Ordinary methods and functions are not measured.

Replace a multi-role callback with a named interface, protocol, or event object.

## Bad

```ts
type MemberChanged = (owner: string, name: string, before: string, after: string) => void;
```


## Good

```ts
/** Responsibilities: _member event contract_. **/
export interface MemberChangedContract {
	changed(event: string): void;
}
```

