# `typescript-overload`

Do not hide multiple contracts behind TypeScript overload signatures. Replace
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

```ts
// Good
public violation(file: string, line: number, parameters: RuleParameters = {}): Violation {
	return this.create_violation(file, line, parameters);
}
```
