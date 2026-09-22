import type { PythonTestFramework } from 'src/bridge/ts/runner/orchestration/runtime/python/types';

/** Responsibilities: _Python test framework count_, _framework totals comparison_. **/
export class TestFrameworkCounts {
	private readonly counts = new Map<PythonTestFramework, number>();

	/** Responsibilities: _increment framework count_. **/
	public add(framework: PythonTestFramework): void {
		const current_count = this.counts.get(framework);
		if (current_count === undefined) {
			this.counts.set(framework, 1);
			return;
		}
		this.counts.set(framework, current_count + 1);
	}

	/** Responsibilities: _output framework count_. **/
	public count(framework: PythonTestFramework): number {
		const count = this.counts.get(framework);
		if (count === undefined) {
			return 0;
		}
		return count;
	}

	/** Responsibilities: _reporting tests usage framework_. **/
	public all(framework: PythonTestFramework, total: number): boolean {
		return this.count(framework) === total;
	}

}
