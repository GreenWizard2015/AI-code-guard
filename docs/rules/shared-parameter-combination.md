# `shared-parameter-combination`

**Purpose:** Repeated parameter bundles indicate a missing value object.

```ts
function a(id: string, tab: Tab): void {}
function b(id: string, tab: Tab): void {}
```

The rule intersects the exact sorted callable locations of each parameter node. A candidate may
contain any number of reference and basic parameters, but it must contain at least one reference
type. Basic identity includes both name and type, so `id:string`, `name:string`, and `id:number`
remain separate.

All supported subsets are reported. Pairwise overlap cannot create a larger candidate unless the
same callable locations contain the complete parameter set.

**Fix:** Introduce a named context/options type for the complete combination and update every
listed caller to pass that contract.
