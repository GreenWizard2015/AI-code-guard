# `single-item-array-state`

Description: Do not represent a nullable domain result as a zero-or-one array and extract its value with indexing or array destructuring.

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

The rule reports any element access on a locally declared function, method, or arrow function whose declared result is an array. It also reports a local value assigned from `[0]` and immediately guarded against `undefined`. In Python, the equivalent is a locally declared function or method returning `list[T]` or `List[T]` and then accessed by index. Real collection processing should use a named collection contract and explicit collection operations rather than using an indexed access as a missing-value state.


## Bad

```ts
// File: cli.ts
function find_items(): string[] {
	return ["item"];
}

const item = find_items()[0];
console.log(item);
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
