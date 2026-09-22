# `single-item-array-state`

**Purpose:** Do not replace a nullable domain result with an array whose first element is treated as the value, including a temporary `[0]` value followed by an `undefined` guard.

**Bad:**

```ts
function find_service(): Service[] {
	return [];
}

const service = find_service()[any_index];
```

**Fix:** Return an explicit state contract, such as `FoundService | MissingService`, and let each state own its behavior.

```ts
function find_service(): ServiceResult {
	return new MissingService();
}
```

The rule reports any element access on a locally declared function, method, or arrow function whose declared result is an array. It also reports a local value assigned from `[0]` and immediately guarded against `undefined`. In Python, the equivalent is a locally declared function or method returning `list[T]` or `List[T]` and then accessed by index. Real collection processing should use a named collection contract and explicit collection operations rather than using an indexed access as a missing-value state.
