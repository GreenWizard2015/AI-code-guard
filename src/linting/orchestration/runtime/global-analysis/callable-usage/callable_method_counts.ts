import type { CallableDefinition } from "src/metrics/types";
import type { CallableMethodCountsContract } from "src/shared_services_protocols";

/** Responsibilities: _method counts_, _method names_. **/
export class CallableMethodCounts implements CallableMethodCountsContract {
	private readonly counts: Map<string, number>;

	/** Responsibilities: _aggregation method definition its_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.counts = new Map<string, number>();
	}
	/** Responsibilities: _public operation_. **/
	public append(definition: CallableDefinition): void {
		if (definition.kind !== "method") {
			return;
		}
		const name = definition.node.name;
		let count = this.counts.get(name);
		if (count === undefined) {
			count = 0;
		}
		this.counts.set(name, count + 1);
	}

	/** Responsibilities: _output count method name_. **/
	public count(name: string): number {
		const count = this.counts.get(name);
		if (count === undefined) {
			return 0;
		}
		return count;
	}
}
