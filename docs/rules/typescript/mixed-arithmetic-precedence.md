# `mixed-arithmetic-precedence`

Description: Split an arithmetic expression or add parentheses when it mixes `+`, `-`, `*`, `/`, `%`, `//`, and `**` in one ungrouped expression. Parentheses around a larger expression do not hide a mixed expression inside that group.

## Bad

```ts
// File: src/arithmetic_report.ts
export class ArithmeticReport {
	private readonly first: number;
	private readonly second: number;
	private readonly third: number;
	public constructor(first: number, second: number, third: number) {
		this.first = first;
		this.second = second;
		this.third = third;
	}
	public total(): number {
		return this.first + this.second / this.third; // <- error
	}
	public scaled_total(): number {
		return this.first + this.second * this.third; // <- error
	}
	public summary(): string {
		const total = this.total();
		const scaled = this.scaled_total();
		return `Total ${total}; scaled ${scaled}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ArithmeticReport } from "src/arithmetic_report";
(function () {
	const report = new ArithmeticReport(12, 3, 2);
	report.report();
})();
```

## Good

```ts
// File: src/arithmetic_report.ts
export class ArithmeticReport {
	private readonly _first: number;
	private readonly _second: number;
	private readonly _third: number;
	public constructor(first: number, second: number, third: number) {
		this._first = first;
		this._second = second;
		this._third = third;
	}
	public total(): number {
		if (this._third === 0) {
			return this._first;
		}
		return this._first + (this._second / this._third);
	}
	public scaled_total(): number {
		return this._first + (this._second * this._third);
	}
	public summary(): string {
		const total = this.total();
		const scaled = this.scaled_total();
		return `Total ${total}; scaled ${scaled}`;
	}
	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
import { ArithmeticReport } from "src/arithmetic_report";
(function () {
	const report = new ArithmeticReport(12, 3, 2);
	report.report();
})();
```
