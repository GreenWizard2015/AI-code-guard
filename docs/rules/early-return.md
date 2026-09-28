# `early-return`

Prefer an early exit when both branches only return a value:

```text
if condition:
    return first
else:
    return second
```

 becomes an `if` with the first return followed by the second return. This
removes unnecessary nesting and makes the continuation after the guarded case
explicit.

```ts
function choose(ready: boolean): string {
	if (ready) {
		return 'first';
	}
	return 'second';
}
```

```py
def choose(ready: bool) -> str:
    if ready:
        return 'first'
    return 'second'
```
