# Finite variant mapping is incomplete

Description: For statically known enums, string-literal unions, and tagged unions, report an explicit partial mapping when the default branch maps remaining source variants to one target variant. Ignore fallbacks that reject the value or preserve the source value. Tagged unions are analyzed when their string-literal discriminator is statically resolved.

## Bad

```ts
// File: src/status_mapper.ts
import { SourceState, TargetState } from "src/types";
export class StatusMapper {
	private readonly source: SourceState;
	public constructor(source: SourceState) { this.source = source; }
	public map_target_state(value: SourceState): TargetState {
		switch (value) {
			case SourceState.Ready: return TargetState.Available;
			default: return TargetState.Error; // <- error
		}
	}
	public format_source_state(): string {
		switch (this.source) {
			case SourceState.Ready: return "Ready";
			case SourceState.Failed: return "Failed";
			case SourceState.Pending: return "Pending";
			default: throw new Error("Unexpected source state label");
		}
	}
	public format_summary(): string { return `${this.format_source_state()} => ${this.format_target_state()}`; }
	public format_target_state(): string {
		switch (this.map_target_state(this.source)) {
			case TargetState.Available: return "Available";
			case TargetState.Error: return "Error";
			case TargetState.Waiting: return "Waiting";
			default: throw new Error("Unexpected target state label");
		}
	}
	public report(): void { console.log(this.format_summary()); }
}
// File: src/types.ts
export enum SourceState { Ready, Failed, Pending }
export enum TargetState { Available, Error, Waiting }
// File: cli.ts
import { StatusMapper } from "src/status_mapper";
import { SourceState } from "src/types";
(function () {
	const mapper = new StatusMapper(SourceState.Ready);
	mapper.report();
})();
```

## Good

```ts
// File: src/types.ts
export enum SourceState { Ready, Failed, Pending }
export enum TargetState { Available, Error, Waiting }
// File: src/status_mapper.ts
import { SourceState, TargetState } from "src/types";
export class StatusMapper {
	private readonly _source: SourceState;
	public constructor(source: SourceState) { this._source = source; }
	public map_target_state(value: SourceState): TargetState {
		switch (value) {
			case SourceState.Ready: return TargetState.Available;
			case SourceState.Failed: return TargetState.Error;
			case SourceState.Pending: return TargetState.Waiting;
			default: throw new Error("Unsupported source state");
		}
	}
	public format_source_state(): string {
		switch (this._source) {
			case SourceState.Ready: return "Ready";
			case SourceState.Failed: return "Failed";
			case SourceState.Pending: return "Pending";
			default: throw new Error("Unsupported source state label");
		}
	}
	public format_summary(): string { return `${this.format_source_state()} => ${this.format_target_state()}`; }
	public format_target_state(): string {
		switch (this.map_target_state(this._source)) {
			case TargetState.Available: return "Available";
			case TargetState.Error: return "Error";
			case TargetState.Waiting: return "Waiting";
			default: throw new Error("Unsupported target state label");
		}
	}
	public report(): void { console.log(this.format_summary()); }
}
// File: cli.ts
import { StatusMapper } from "src/status_mapper";
import { SourceState } from "src/types";
(function () {
	const mapper = new StatusMapper(SourceState.Ready);
	mapper.report();
})();
```
