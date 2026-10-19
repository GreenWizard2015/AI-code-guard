# `logical-chain-size`

Description: Logical conditions with more than three parts or at least 100 significant characters are difficult to name,
review, and reuse. The rule counts the operands in a connected TypeScript `&&`, `||`, or `??`
expression and Python `and` or `or` expression. A single operand is ignored because it is not a
logical chain. Significant characters are counted with the same whitespace-insensitive metric used by callable-size checks. Mixed nested logical operators are counted as one chain, and only the outer
expression is reported.

```ts
return has_name && has_type && is_active && is_visible;
```

### Fix

Extract the condition into a named boolean variable or a predicate method, then use that
name at the decision or return boundary.

```ts
const can_publish = has_name && has_type && is_active && is_visible;
return can_publish;
```


## Bad

```ts
function can_publish(has_name: boolean, has_type: boolean, is_active: boolean, is_visible: boolean): boolean {
	return has_name && has_type && is_active && is_visible;
}
```


## Good

```ts
// File: cli.ts
(function () {
	const is_ready = true;
	const has_value = true;
	const ready = is_ready && has_value;
	console.log(ready);
})();
```

