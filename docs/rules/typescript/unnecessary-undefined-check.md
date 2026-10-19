# `unnecessary-undefined-check`

Description: Detect a condition that checks a required field for an absent value.

**Bad:**

```ts
type Parsed = {
	attribute_accesses: string[];
};

function has_attributes(parsed: Parsed): boolean {
	return parsed.attribute_accesses === undefined;
}
```


Fix: Remove the check when the field is required.

The TypeScript implementation uses AST declarations and reports only property accesses whose
declared field is required. It also reports optional chaining such as
`parsed?.attribute_accesses` when both the receiver and the field are required.

The Python implementation uses the Python AST and local class annotations. It recognizes
`is None`, `is not None`, `== None`, and `!= None` for fields declared without `Optional`,
`Union[..., None]`, or `| None`.

Unknown declarations and nullable annotations are intentionally skipped.

## Bad

```ts
type ParsedValue = { attribute_accesses: string[] };

function has_attributes(parsed: ParsedValue): boolean {
	return parsed.attribute_accesses === undefined;
}
```


## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
