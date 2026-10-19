# `duplicate-type-shape`

Description: Reports distinct named object types or Python classes with identical sorted
field/type and base-type signatures. Field order does not affect the shape.
Python classes with different native bases remain distinct.

## Bad

```ts
type JsonResponse = { status: number; payload: string };
type TextResponse = { status: number; payload: string };
```


## Good

```ts
// File: src/protocols.ts
/** Responsibilities: _JSON response contract_. **/
export interface JsonResponseContract {
	serialize(): string;
}

/** Responsibilities: _text response contract_. **/
export interface TextResponseContract {
	serialize(): string;
}
```

