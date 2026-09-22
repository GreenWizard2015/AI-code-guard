# `bare-type-alias`

**Purpose:** Renaming one existing type does not create a useful boundary and obscures ownership.

```ts
export type FacebookRelayReactionValue = FacebookReactionInput;
```

**Fix:** Use `FacebookReactionInput` directly, or define a distinct interface, object shape, or
wrapper with its own contract. A generic alias whose RHS is its type parameter, such as
`type Identity<T> = T`, is allowed.
