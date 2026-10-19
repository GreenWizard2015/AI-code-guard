# `overload`

Description: Do not hide multiple contracts behind TypeScript overload signatures. Replace
the overload set with one explicit method or function contract, usually backed
by a named result or state class.

```ts
// Bad
public violation(file: string, line: number): Violation;
public violation(file: string, line: number, parameters: RuleParameters): Violation;
public violation(file: string, line: number, parameters: RuleParameters = {}): Violation {
	return this.create_violation(file, line, parameters);
}
```

### Replacement

```ts
class TextFormatter {
	public format(value: string | number): string { return String(value); }
}
```

## Bad

```ts
class TextFormatter {
	public format(value: string): string;
	public format(value: number): string;
	public format(value: string | number): string { return String(value); }
}
```

## Good

```ts
// File: cli.ts
(function () {
	const value: string = "ready";
})();
```
