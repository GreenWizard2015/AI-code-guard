# `composite-state-type`

## Policy

Do not represent a domain state or a boundary value with a composite union or intersection type.

## Fix

Define an interface for the shared contract and real specialized classes for each state or representation.

```ts
interface UserLookup {
	is_found(): boolean;
}

class FoundUser implements UserLookup {
	public is_found(): boolean {
		return true;
	}
}

class MissingUser implements UserLookup {
	public is_found(): boolean {
		return false;
	}
}
```

This applies to unions such as `Buffer | string` and intersections such as `Buffer & Metadata` at fields, parameters, and return boundaries. Wrap the representations behind a named interface and specialized classes. It also applies to object-state unions with a string or boolean discriminant.

Literal unions, compiler unions, and primitive unions are also covered. A literal such as `'found'` may remain a field value on the interface, but the contract itself must not branch into a union type.

## JSON-RPC responses

For an outgoing JSON-RPC tool response, use separate response classes instead of
a composite `JsonRpcResponse` object with optional `result` and `error` fields.
`ToolResponse.payload()` and `ToolErrorResponse.payload()` should create the
structural JSON object immediately before it is passed to the transport. This
keeps the external wire format intact while preventing mutually exclusive
response states from spreading through production code.
