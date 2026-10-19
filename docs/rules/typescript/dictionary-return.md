# `dictionary-return`

Description: Use a class when a returned dictionary-shaped value owns behavior or lifecycle; retain a data type for plain data.

## Bad

```ts
type TextReader = { read_text(): string };
function create_reader(): TextReader { return { read_text: () => "text" }; }
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
