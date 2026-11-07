# `nested-class`

Description: Nested classes hide ownership and make dependencies harder to discover.

```ts
class Service {
  public static readonly state = class State {};
}
```

## Bad

```ts
// File: src/service.ts
export class Service {
	public static readonly state = class State {
		private readonly value: string;
		public constructor(value: string) {
			this.value = value;
		}
		public normalized_label(): string {
			const label = this.value.trim().toUpperCase();
			if (label.length === 0) {
				return "UNKNOWN";
			}
			return label;
		}
		public is_ready(): boolean {
			return this.normalized_label() === "READY";
		}
	};
	public report(): void {
		const state = new Service.state("ready");
		const label = state.normalized_label();
		const ready = state.is_ready();
		console.log(`${label} | ready=${ready}`);
	}
}
// File: cli.ts
import { Service } from "src/service";
(function () {
	const service = new Service();
	service.report();
})();
```


**Fix:** Move the class to a focused top-level module or use composition. Dataclasses and
exception classes remain valid small-file owners.


## Good

```ts
// File: src/service_state.ts
export class ServiceState {
	private readonly _value: string;
	public constructor(value: string) {
		this._value = value;
	}
	public normalized_label(): string {
		const label = this._value.trim().toUpperCase();
		if (this._value.trim().length === 0) {
			return "UNKNOWN";
		}
		return label;
	}
	public label_length(): number {
		return this.normalized_label().length;
	}
	public word_count(): number {
		const words = this.normalized_label().split(/\s+/u);
		if (words.length === 1 && words[0].length === 0) {
			return 0;
		}
		return words.length;
	}
}
// File: src/service_status.ts
import { ServiceState } from "src/service_state";

export class ServiceStatus {
	private readonly _state: ServiceState;
	public constructor(initial_label: string) {
		this._state = new ServiceState(initial_label);
	}
	public status_label(): string {
		const label = this._state.normalized_label();
		return `Service status: ${label}`;
	}
	public ready(): boolean {
		const label = this.status_label();
		return label.endsWith("READY");
	}
	public status_details(): string {
		const label = this.status_label();
		const length = this._state.label_length();
		const words = this._state.word_count();
		return `${label} (${length} characters, ${words} words)`;
	}
	public report(): void {
		const details = this.status_details();
		const ready = this.ready();
		console.log(`${details} | ready=${ready}`);
	}
}
// File: cli.ts
import { ServiceStatus } from "src/service_status";
(function () {
	const status = new ServiceStatus("ready");
	status.report();
})();
```

