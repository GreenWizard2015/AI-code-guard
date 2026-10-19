# `shared-parameter-combination`

Description: Repeated parameter bundles indicate a missing value object.

```ts
function a(id: string, tab: Tab): void {}
function b(id: string, tab: Tab): void {}
```

## Bad

```ts
// File: src/transfer-session.ts
export class TransferSession {
	public send_one(data: TransferData, key: string): string { return data.name + key; }
	public send_two(data: TransferData, key: string): string { return data.name + key; }
	public send_three(data: TransferData, key: string): string { return data.name + key; }
	public send_four(data: TransferData, key: string): string { return data.name + key; }
}
// File: src/transfer-data.ts
export class TransferData { public readonly name: string = "item"; }
// File: cli.ts
import { TransferSession } from "src/transfer-session";
import { TransferData } from "src/transfer-data";
const session = new TransferSession();
const data = new TransferData();
session.send_one(data, "a");
session.send_two(data, "b");
session.send_three(data, "c");
session.send_four(data, "d");
```


The rule intersects the exact sorted callable locations of each parameter node. A candidate may
contain any number of reference and basic parameters, but it must contain at least one reference
type. Basic identity includes both name and type, so `id:string`, `name:string`, and `id:number`
remain separate.

Reference-parameter singletons and maximal supported combinations are reported. Redundant
subsets are compacted when a larger combination has the same callable support; this keeps the
diagnostic bounded for dense parameter groups.

**Fix:** Introduce a named context/options type for the complete combination and update every
listed caller to pass that contract.

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
