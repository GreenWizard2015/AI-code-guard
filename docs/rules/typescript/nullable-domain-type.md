# `nullable-domain-type`

Description: Do not use `null`, `undefined`, `None`, `Optional`, `Any`, `unknown`, `void`,
or `never` at a field, parameter, or return boundary. Model meaningful absence
with an explicit domain contract instead of a nullable value.

## Bad

```ts
// File: cli.ts
function display_label(label: string | null): string | undefined {
	if (label === null) {
		return undefined;
	}
	return label.trim();
}

(function () {
	console.log(display_label(null));
})();
```


If absence is a real state, define an interface or protocol for the shared
behavior and distinct classes for each state. Keep the serialized boundary
representation local to the adapter that communicates with an external system.

## Good

```ts
// File: cli.ts
/** Responsibilities: _label display_. **/
function display_label(label: string): string {
	return label.trim();
}

(function () {
	console.log(display_label("ready"));
})();
```

