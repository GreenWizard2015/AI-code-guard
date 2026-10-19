import { performance } from "node:perf_hooks";
import type { LintStageDuration, LintStageFormatState } from "src/types";
import type { AsyncOperation, LintStageTimerContract, Operation } from "src/protocols";

/** Responsibilities: _stage duration recording_, _hierarchical timing formatting_. **/
export class LintStageTimer implements LintStageTimerContract {
	private readonly durations_by_stage: Map<string, number>;

	/** Responsibilities: _calculation stage duration percentage_. **/
	private parent_percentage(
		stage: LintStageDuration,
		parent_name: string,
		durations_by_name: ReadonlyMap<string, LintStageDuration>,
	): number {
		const parent = durations_by_name.get(parent_name);
		if (parent === undefined || parent.duration_ms === 0) {
			return 0;
		}
		return (stage.duration_ms / parent.duration_ms) * 100;
	}

	/** Responsibilities: _resolution direct stage parent_. **/
	private direct_parent(stage: LintStageDuration, names: ReadonlySet<string>): string {
		let separator = stage.name.lastIndexOf(".");
		while (separator > 0) {
			const parent = stage.name.slice(0, separator);
			if (names.has(parent)) {
				return parent;
			}
			separator = parent.lastIndexOf(".");
		}
		return "";
	}

	/** Responsibilities: _aggregation child stage indexing_. **/
	private append_child(children: Map<string, LintStageDuration[]>, parent: string, stage: LintStageDuration): void {
		let siblings = children.get(parent);
		if (siblings === undefined) {
			siblings = [];
		}
		siblings.push(stage);
		children.set(parent, siblings);
	}

	/** Responsibilities: _index direct stage hierarchy_. **/
	private children_by_parent(
		all_durations: readonly LintStageDuration[],
	): ReadonlyMap<string, readonly LintStageDuration[]> {
		const names = new Set(all_durations.map((stage) => stage.name));
		const children = new Map<string, LintStageDuration[]>();
		for (const stage of all_durations) {
			const parent = this.direct_parent(stage, names);
			if (parent.length > 0) {
				this.append_child(children, parent, stage);
			}
		}
		return children;
	}

	/** Responsibilities: _aggregation formatting stage duration_. **/
	private append_stage(state: LintStageFormatState): void {
		const name = state.stage.name.slice(state.parent_name.length + 1);
		const percentage = this.parent_percentage(state.stage, state.parent_name, state.durations_by_name);
		state.lines.push(
			`${state.indent}- ${name}: ${state.stage.duration_ms.toFixed(2)} ms (${percentage.toFixed(2)}% of parent)`,
		);
		const stage_children = state.children.get(state.stage.name);
		if (stage_children === undefined) {
			return;
		}
		for (const child of stage_children) {
			this.append_stage({
				lines: state.lines,
				parent_name: state.stage.name,
				stage: child,
				durations_by_name: state.durations_by_name,
				children: state.children,
				indent: `${state.indent}  `,
			});
		}
	}

	/** Responsibilities: _aggregation child stage formatting_. **/
	private append_stage_children(state: LintStageFormatState): void {
		const stage_children = state.children.get(state.stage.name);
		if (stage_children === undefined) {
			return;
		}
		for (const child of stage_children) {
			this.append_stage({
				lines: state.lines,
				parent_name: state.stage.name,
				stage: child,
				durations_by_name: state.durations_by_name,
				children: state.children,
				indent: `${state.indent}  `,
			});
		}
	}

	/** Responsibilities: _aggregation top-level stage formatting_. **/
	private append_root_stage(
		lines: string[],
		stage: LintStageDuration,
		durations_by_name: ReadonlyMap<string, LintStageDuration>,
		children: ReadonlyMap<string, readonly LintStageDuration[]>,
	): void {
		lines.push(`- ${stage.name}: ${stage.duration_ms.toFixed(2)} ms`);
		this.append_stage_children({
			lines,
			stage,
			parent_name: "",
			durations_by_name,
			children,
			indent: "  ",
		});
	}

	/** Responsibilities: _aggregation measurement stage duration_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.durations_by_stage = new Map<string, number>();
	}
	/** Responsibilities: _public operation_. **/
	public add_duration(stage_name: string, elapsed: number): void {
		let previous = this.durations_by_stage.get(stage_name);
		if (previous === undefined) {
			previous = 0;
		}
		this.durations_by_stage.set(stage_name, previous + elapsed);
	}

	/** Responsibilities: _measurement synchronous lint operation_. **/
	public measure<T>(stage_name: string, operation: Operation<T>): T {
		const start_time = performance.now();
		try {
			return operation();
		} finally {
			this.add_duration(stage_name, performance.now() - start_time);
		}
	}

	/** Responsibilities: _measurement asynchronous lint operation_. **/
	public async measure_async<T>(stage_name: string, operation: AsyncOperation<T>): Promise<T> {
		const start_time = performance.now();
		try {
			return await operation();
		} finally {
			this.add_duration(stage_name, performance.now() - start_time);
		}
	}

	/** Responsibilities: _exposure measurement stage durations_. **/
	public durations(): readonly LintStageDuration[] {
		const stage_entries = [...this.durations_by_stage.entries()];
		return stage_entries.map(([name, duration_ms]) => ({
			name,
			duration_ms,
		}));
	}

	/** Responsibilities: _measurement stages parent-relative formatting_. **/
	public format(): string {
		const all_durations = this.durations();
		const durations_by_name = new Map(all_durations.map((stage) => [stage.name, stage]));
		const children = this.children_by_parent(all_durations);
		const top_level_durations = all_durations.filter((stage) => !stage.name.includes("."));
		const lines = ["Stage durations:"];
		for (const stage of top_level_durations) {
			this.append_root_stage(lines, stage, durations_by_name, children);
		}
		return lines.join("\n");
	}
}
