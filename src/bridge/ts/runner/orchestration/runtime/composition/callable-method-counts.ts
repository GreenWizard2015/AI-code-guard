import type { CallableDefinition } from 'src/metrics/types';

/** Responsibilities: _named method definition count_. **/
export class CallableMethodCounts {
	private readonly counts = new Map<string, number>();

	/** Responsibilities: _aggregation method definition its_. **/
	public append(definition: CallableDefinition): void {
		if (definition.kind !== 'method') {
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
