# `private-member`

Description: Access private state through a public operation on its owning class.

## Bad

```ts
// File: src/account_statement.ts
export class AccountStatement {
	private readonly _account_name: string;
	private readonly _entries: readonly string[];
	private readonly _period: string;
	public constructor(account_name: string, entries: readonly string[], period: string) {
		this._account_name = account_name;
		this._entries = entries;
		this._period = period;
	}
	public render(): string {
		const details = this._entries.map((entry) => `- ${entry}`).join("\n");
		if (details.length === 0) { return `${this._account_name} ${this._period}: no entries`; }
		return `${this._account_name} ${this._period}\n${details}`;
	}
	public entry_count(): number { return this._entries.length; }
	public subtitle(): string { return `${this.entry_count()} entries`; }
	public report(): void { console.log(`${this.render()}\n${this.subtitle()}`); }
}
// File: cli.ts
import { AccountStatement } from "src/account_statement";

class Cli {
	private readonly _account_balance: number;
	private readonly _currency: string;
	public constructor(balance: number, currency: string) {
		this._account_balance = balance;
		this._currency = currency;
	}
	public formatted_balance(): string { return `${this._currency} ${this._account_balance}`; }
	public withdrawal_text(amount: number): string {
		if (amount < 0) { return "invalid amount"; }
		if (amount > this._account_balance) { return "insufficient funds"; }
		return `${this._currency} ${this._account_balance - amount}`;
	}
	public report_balance(): void {
		const statement = new AccountStatement("Account", [this.formatted_balance()], "today");
		statement.report();
	}
}
(function () {
	const cli = new Cli(20, "USD");
	const exposed_balance = cli._account_balance;
	cli.withdrawal_text(exposed_balance);
	cli.report_balance();
})();
```

## Good

```ts
// File: src/account_statement.ts
export class AccountStatement {
	private readonly _account_name: string;
	private readonly _entries: readonly string[];
	private readonly _period: string;
	public constructor(account_name: string, entries: readonly string[], period: string) {
		this._account_name = account_name;
		this._entries = entries;
		this._period = period;
	}
	public render(): string {
		const details = this._entries.map((entry) => `- ${entry}`).join("\n");
		if (details.length === 0) { return `${this._account_name} ${this._period}: no entries`; }
		return `${this._account_name} ${this._period}\n${details}`;
	}
	public entry_count(): number { return this._entries.length; }
	public subtitle(): string { return `${this.entry_count()} entries`; }
	public report(): void { console.log(`${this.render()}\n${this.subtitle()}`); }
}
// File: cli.ts
import { AccountStatement } from "src/account_statement";

class Cli {
	private readonly _account_balance: number;
	private readonly _currency: string;
	public constructor(balance: number, currency: string) {
		this._account_balance = balance;
		this._currency = currency;
	}
	public formatted_balance(): string { return `${this._currency} ${this._account_balance}`; }
	public withdrawal_text(amount: number): string {
		if (amount < 0) { return "invalid amount"; }
		if (amount > this._account_balance) { return "insufficient funds"; }
		return `${this._currency} ${this._account_balance - amount}`;
	}
	public report_balance(): void {
		const statement = new AccountStatement("Account", [this.formatted_balance()], "today");
		statement.report();
	}
}
(function () {
	const cli = new Cli(20, "USD");
	cli.withdrawal_text(5);
	cli.report_balance();
})();
```
