import { performance } from 'node:perf_hooks';
import type { LintStageDuration } from 'src/bridge/ts/core/types';

/** Responsibilities: _measurement lint stages retention_. **/
export class LintStageTimer {
	private readonly durations_by_stage = new Map<string, number>();

	/** Responsibilities: _storage measurement stage duration_. **/
	private remember_duration(stage_name: string, elapsed: number): void {
		let previous = this.durations_by_stage.get(stage_name);
		if (previous === undefined) {
			previous = 0;
		}
		this.durations_by_stage.set(stage_name, previous + elapsed);
	}

	/** Responsibilities: _calculation stage duration percentage_. **/
	private parent_percentage(
		stage: LintStageDuration,
		parent_name: string,
		all_durations: readonly LintStageDuration[]
	): number {
		const parent = all_durations.find(item => item.name === parent_name);
		if (parent === undefined || parent.duration_ms === 0) {
			return 0;
		}
		return (stage.duration_ms / parent.duration_ms) * 100;
	}

	/** Responsibilities: _classification stage direct child_. **/
	private is_direct_child(
		stage_name: string,
		parent_name: string,
		all_durations: readonly LintStageDuration[]
	): boolean {
		if (!stage_name.startsWith(`${parent_name}.`)) {
			return false;
		}
		return !all_durations.some(intermediate =>
			intermediate.name !== stage_name &&
			intermediate.name.startsWith(`${parent_name}.`) &&
			stage_name.startsWith(`${intermediate.name}.`)
		);
	}

	/** Responsibilities: _collection direct child durations_. **/
	private direct_children(
		parent_name: string,
		all_durations: readonly LintStageDuration[]
	): readonly LintStageDuration[] {
		const children: LintStageDuration[] = [];
		for (const stage of all_durations) {
			if (this.is_direct_child(stage.name, parent_name, all_durations)) {
				children.push(stage);
			}
		}
		return children;
	}

	/** Responsibilities: _aggregation formatting stage duration_. **/
	private append_stage(
		lines: string[],
		parent_name: string,
		stage: LintStageDuration,
		all_durations: readonly LintStageDuration[],
		indent: string
	): void {
		const name = stage.name.slice(parent_name.length + 1);
		const percentage = this.parent_percentage(stage, parent_name, all_durations);
		lines.push(`${indent}- ${name}: ${stage.duration_ms.toFixed(2)} ms (${percentage.toFixed(2)}% of parent)`);
		for (const child of this.direct_children(stage.name, all_durations)) {
			this.append_stage(lines, stage.name, child, all_durations, `${indent}  `);
		}
	}

	/** Responsibilities: _measurement synchronous lint operation_. **/
	public measure<T>(stage_name: string, operation: () => T): T {
		const start_time = performance.now();
		try {
			return operation();
		} finally {
			this.remember_duration(stage_name, performance.now() - start_time);
		}
	}

	/** Responsibilities: _measurement file-scoped operation stage_. **/
	public measure_file<T>(
		language: string,
		relative_path: string,
		operation: () => T
	): T {
		const language_stage = `file-analysis.${language}`;
		const file_stage = `${language_stage}.${relative_path}`;
		return this.measure(file_stage, () => this.measure(language_stage, operation));
	}

	/** Responsibilities: _exposure measurement stage durations_. **/
	public durations(): readonly LintStageDuration[] {
		return [...this.durations_by_stage.entries()].map(([name, duration_ms]) => ({
			name,
			duration_ms,
		}));
	}

	/** Responsibilities: _measurement stages parent-relative formatting_. **/
	public format(): string {
		const all_durations = this.durations();
		const top_level_durations = all_durations.filter(stage => !stage.name.includes('.'));
		const lines = ['Stage durations:'];
		for (const stage of top_level_durations) {
			lines.push(`- ${stage.name}: ${stage.duration_ms.toFixed(2)} ms`);
			for (const child of this.direct_children(stage.name, all_durations)) {
				this.append_stage(lines, stage.name, child, all_durations, '  ');
			}
		}
		return lines.join('\n');
	}
}
