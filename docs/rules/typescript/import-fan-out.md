# import-fan-out

Description: Problem: module imports too many distinct modules.

Hint: Split the module by cohesive responsibility or move composition wiring to
a focused assembly module. Do not: bypass the limit by importing individual
objects through aliases.

The rule counts unique module specifiers, not imported names. For example,
`import { A, B } from "./module"` counts as one module.

## Bad

```ts
{% const module_names = ["module_01", "module_02", "module_03", "module_04", "module_05", "module_06", "module_07", "module_08", "module_09", "module_10", "module_11", "module_12", "module_13", "module_14", "module_15", "module_16", "module_17", "module_18", "module_19", "module_20", "module_21"] %}
{% for module_name in module_names %}
// File: src/domain/{{module_name}}.ts
export class ModuleFeature {
	private readonly code: string;

	public constructor(code: string) {
		this.code = code;
	}

	public normalized_code(): string {
		return this.code.trim().toLowerCase();
	}

	public status_label(): string {
		return `Loaded ${this.normalized_code()}`;
	}

	public report(): void {
		console.log(this.status_label());
	}
}
{% endfor %}
// File: cli.ts
{% for module_name in module_names %}
import * as {{module_name}} from "src/domain/{{module_name}}"; // <- error
{% endfor %}
(function () {
{% for module_name in module_names %}
	const feature_{{module_name}} = new {{module_name}}.ModuleFeature("{{module_name}}");
	feature_{{module_name}}.report();
{% endfor %}
})();
```


## Good

```ts
// File: src/account_workflow.ts
export class AccountWorkflow {
	private readonly _account_name: string;

	public constructor(account_name: string) {
		this._account_name = account_name;
	}

	public account_state(): string {
		if (this._account_name.trim().length === 0) {
			return "pending";
		}
		return "ready";
	}

	public status_label(): string {
		if (this.account_state() === "ready") {
			return `Ready: ${this._account_name.trim()}`;
		}
		return "Account pending";
	}

	public report(): void {
		console.log(this.status_label());
	}
}
// File: cli.ts
import { AccountWorkflow } from "src/account_workflow";
(function () {
	const workflow = new AccountWorkflow("primary");
	workflow.report();
})();
```

