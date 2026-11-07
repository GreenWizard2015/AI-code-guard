# `fake-object`

Description: Object literals with callable fields imitate classes without invariants or owned state.

Data-only object literals are outside this rule. A payload or configuration object with no
callable field does not imitate a class and must not be reported as `typescript-fake-object`.

Callable result objects created inside a function are allowed when they are a local return value or
factory result. The rule targets module-level objects that act as namespaces or long-lived services.

Lint diagnostic:

```text
avoid object literals that imitate classes
```

```ts
const FEEDBACK: FeedbackPort = {
  write: async (text, reaction) => {
    await client.call({ name: 'gwmcp_files_write', args: { text, reaction } });
  },
};
```

The object above owns callable behavior but has no named owner. Use a focused class when the
behavior needs dependencies or state:

```ts
class FeedbackWriter implements FeedbackPort {
  private readonly client: ProxyMcpClient;

  public constructor(client: ProxyMcpClient) {
    this.client = client;
  }

  public async write(text: string, reaction: SuggestionReaction): Promise<void> {
    const name = 'gwmcp_files_write';
    const args = { text, reaction };
    await this.client.call({ name, args });
  }
}
```

If the operation is stateless, use explicit module functions instead of a callable object.

## Bad

```ts
// File: src/result_action.ts
export const RESULT_ACTION = {
	value: " ready ",
	reported_values: [] as string[],
	display_value(): string {
		const normalized_value = this.value.trim().toUpperCase();
		if (normalized_value.length === 0) {
			return "";
		}
		return normalized_value;
	},
	report(): void {
		const value = this.display_value();
		this.reported_values.push(value);
		let label = value;
		let availability = "available";
		if (value.length === 0) {
			label = "EMPTY";
			availability = "empty";
		}
		const fields = [label, `state=${availability}`, `reports=${this.reported_values.length}`];
		console.log(fields.join(" | "));
	},
};
// File: cli.ts
import { RESULT_ACTION } from "src/result_action";
(function () {
	RESULT_ACTION.report();
})();
```

## Good

```ts
// File: src/result_action.ts
export class ResultAction {
	private readonly _value: string;
	private readonly _reported_values: string[];
	public constructor(value: string) {
		this._value = value;
		this._reported_values = [];
	}
	public display_value(): string {
		const normalized_value = this._value.trim().toUpperCase();
		if (normalized_value.length === 0) {
			return "";
		}
		return normalized_value;
	}
	public report(): void {
		const value = this.display_value();
		this._reported_values.push(value);
		let label = value;
		let availability = "available";
		if (value.length === 0) {
			label = "EMPTY";
			availability = "empty";
		}
		const fields = [label, `state=${availability}`, `reports=${this._reported_values.length}`];
		console.log(fields.join(" | "));
	}
}
// File: cli.ts
import { ResultAction } from "src/result_action";
(function () {
	const result = new ResultAction("ready");
	result.report();
})();
```
