# `single-item-array-state`

Description: Do not represent a nullable result as a single-item array. The rule catches indexed access and `.at(0)` on known single-item array results, plus one-element array destructuring, including argument arrays.

**Bad:**

```ts
interface UserRecord {
	user_id: string;
}

function find_users(owner_id: string): UserRecord[] {
	return owner_id.length > 0 ? [{ user_id: owner_id }] : [];
}

const [user] = find_users("owner-17");
console.log(user?.user_id);
```

### Replacement

**Fix:** Return an explicit state contract, such as `FoundService | MissingService`, and let each state own its behavior.

```ts
function find_service(): ServiceResult {
	return new MissingService();
}
```

The rule reports indexed access and `.at(0)` on a locally declared function, method, or arrow function whose result is a single-item array. It also reports one-element array destructuring, including from argument arrays, and a local value assigned from `[0]` and immediately guarded against `undefined`. In Python, the equivalent is a locally declared function or method returning `list[T]` or `List[T]` and then accessed by index, plus one-element sequence unpacking. Real collection processing should use a named collection contract and explicit collection operations rather than using an indexed access as a missing-value state.


## Bad

```ts
// File: src/item_directory.ts
export class ItemDirectory {
	private readonly items: readonly string[];
	public constructor(items: readonly string[]) { this.items = items; }
	public records_for_directory(): string[] { return this.items.slice(0, 1); }
	public item_count(): number { return this.items.length; }
	public directory_label(): string { return this.items.join(", "); }
	public report(): void {
		const [item] = this.records_for_directory(); // <- error
		const count = this.item_count();
		console.log(`${this.directory_label()}: ${item} (${count} items)`);
	}
}
// File: cli.ts
import { ItemDirectory } from "src/item_directory";
(function () {
	const directory = new ItemDirectory(["item"]);
	directory.report();
})();
```


## Good

```ts
// File: src/item_lookup_result.ts
export class ItemLookupResult {
	private readonly _item_id: string;
	private readonly _label: string;
	private readonly _present: boolean;
	public constructor(item_id: string, label: string, present: boolean) {
		this._item_id = item_id;
		this._label = label;
		this._present = present;
	}
	public item_present(): boolean {
		return this._present;
	}
	public display_label(): string {
		if (!this._present) { return "unavailable"; }
		return this._label.trim();
	}
	public summary(): string {
		return `${this._item_id} (present=${this.item_present()}): ${this.display_label()}`;
	}
	public report(): void {
		console.log(this.summary());
	}
}
// File: cli.ts
import { ItemLookupResult } from "src/item_lookup_result";
(function () {
	const result = new ItemLookupResult("owner-17", "Ada", true);
	result.report();
})();
```
