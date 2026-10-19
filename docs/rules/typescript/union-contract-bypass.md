# `union-contract-bypass`

Description: See the examples below for the rule behavior.

### Policy

Do not hide required contract data behind a union whose branches are a base type and an intersection of that same base type with additional fields.

### Why

This shape makes required metadata optional to callers while appearing to avoid nullable fields. It weakens the domain contract and bypasses the nullable-state policy.

### Fix

Define one explicit interface with all required fields, or use named state classes when the values represent different states.

## Bad

```ts
// File: src/types.ts
type ReportViolationBase = { file: string; line: number };
export type ReportViolation = ReportViolationBase | (ReportViolationBase & { rule_id: string; severity: string });
```

## Good

```ts
// File: src/protocols.ts
export interface ReportViolationContract {
	file(): string;
	line(): number;
	rule_id(): string;
	severity(): string;
}
export interface ReporterContract { report(violation: ReportViolationContract): void; }
```
