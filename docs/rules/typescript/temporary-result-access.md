# `temporary-result-access`

Description: Assign copied arrays and objects created with spread before
accessing their members. Named field and method access on ordinary function
results is allowed.

## Bad

```ts
// File: src/rule_summary_types.ts
export type RuleOptions = Record<string, string>;
// File: src/rule_summary.ts
import type { RuleOptions } from "src/rule_summary_types";

export class RuleSummary {
	private readonly rule_ids: string[];
	private readonly rule_options: RuleOptions;
	private report_count_value = 0;

	public constructor(rule_ids: string[], rule_options: RuleOptions) {
		this.rule_ids = rule_ids;
		this.rule_options = rule_options;
	}

	public report(): void {
		console.log(`${[...this.rule_ids][0]} ${( { ...this.rule_options } ).mode}`);
		this.report_count_value += 1;
	}

	public report_count(): number {
		return this.report_count_value;
	}

	public clear(): void {
		this.rule_ids.length = 0;
		this.rule_options.mode = "";
		this.report_count_value = 0;
	}
}
// File: cli.ts
import { RuleSummary } from "src/rule_summary";

(() => {
	const summary = new RuleSummary(["temporary-result-access"], { mode: "strict" });
	if (summary.report_count() === 0) {
		summary.report();
	}
	summary.clear();
})();
```


**Fix:** Assign constructed objects, indexed call results, and spread copies to
named variables before using them. Ordinary array and object literals are
permitted.

## Good

```ts
// File: src/rule_summary_types.ts
export type RuleIdList = ReadonlyArray<string>;
export type RuleSummaryOptions = { readonly mode: string };
// File: src/rule_summary.ts
import type { RuleIdList, RuleSummaryOptions } from "src/rule_summary_types";

export class RuleSummary {
	private readonly _rule_ids: RuleIdList;
	private readonly _rule_options: RuleSummaryOptions;

	public constructor(rule_ids: RuleIdList, rule_options: RuleSummaryOptions) {
		this._rule_ids = rule_ids;
		this._rule_options = rule_options;
	}

	public first_rule_id(): string {
		const copied_rule_ids = [...this._rule_ids];
		return String(copied_rule_ids[0]);
	}

	public mode_value(): string {
		const option_snapshot = { ...this._rule_options };
		return option_snapshot.mode;
	}

	public rule_count(): number {
		const copied_rule_ids = [...this._rule_ids];
		return copied_rule_ids.length;
	}

	public report(): void {
		console.log(`${this.first_rule_id()} ${this.mode_value()} (${this.rule_count()})`);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { RuleSummary } from "src/rule_summary";

(() => {
	const rule_ids = ["temporary-result-access"];
	const summary = new RuleSummary(rule_ids, { mode: "strict" });
	summary.report();
})();
```

