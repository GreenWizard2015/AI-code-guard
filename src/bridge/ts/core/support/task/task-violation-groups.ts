import { resolve, isAbsolute } from 'node:path';
import type { ReportViolation } from 'src/bridge/ts/core/types';

/** Responsibilities: _group task violations priority_. **/
export class TaskViolationGroups {
	private readonly root: string;

	/** Responsibilities: _resolution violation file path_. **/
	private absolute_file(file: string): string {
		if (isAbsolute(file)) {
			return file;
		}
		return resolve(this.root, file);
	}

	/** Responsibilities: _initialization task root violation_. **/
	public constructor(root: string) {
		this.root = root;
	}

	/** Responsibilities: _output highest priority present_. **/
	public top_priority(violations: readonly ReportViolation[]): number {
		let result = 1;
		for (const violation of violations) {
			if (violation.priority > result) {
				result = violation.priority;
			}
		}
		return result;
	}

	/** Responsibilities: _selection violations requested priority_. **/
	public at_priority(
		violations: readonly ReportViolation[],
		priority: number,
	): ReportViolation[] {
		const result: ReportViolation[] = [];
		for (const violation of violations) {
			if (violation.priority === priority) {
				result.push(violation);
			}
		}
		return result;
	}

	/** Responsibilities: _group violations rule identifier_. **/
	public by_rule(violations: readonly ReportViolation[]): Map<string, ReportViolation[]> {
		const groups = new Map<string, ReportViolation[]>();
		for (const violation of violations) {
			let group = groups.get(violation.rule_id);
			if (group === undefined) {
				group = [];
				groups.set(violation.rule_id, group);
			}
			group.push(violation);
		}
		return groups;
	}

	/** Responsibilities: _absolute source violation count_. **/
	public file_counts(
		violations: readonly ReportViolation[],
	): Map<string, number> {
		const counts = new Map<string, number>();
		for (const violation of violations) {
			const file = this.absolute_file(violation.file);
			const previous = counts.get(file);
			if (previous === undefined) {
				counts.set(file, 1);
				continue;
			}
			counts.set(file, previous + 1);
		}
		return counts;
	}
}
