import { resolve } from "node:path";
import { LintStageTimer } from "src/lint_stage_timer";
import { MainWorkerResults } from "src/linting/orchestration/runtime/file_linting/worker_coordination/main_worker_results";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type {
	TypeScriptWorkerExecution,
	TypeScriptWorkerFinishedResult,
	TypeScriptWorkerOutput,
	TypeScriptWorkerResultAggregatorContract,
	TypeScriptWorkerViolation,
} from "src/type_script_file_worker_pool_types";

/** Responsibilities: _worker diagnostic collection_, _diagnostic merging_. **/
export class TypeScriptWorkerResultAggregator implements TypeScriptWorkerResultAggregatorContract {
	private readonly _root: string;
	private readonly _source_by_relative: Map<string, string>;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _violations_by_file: Map<string, ViolationContract[]>;
	private readonly _root_violations: Map<string, ViolationContract>;

	/** Responsibilities: _root diagnostic collection_. **/
	private append_root_diagnostics(
		violations: readonly ViolationContract[],
		root_violations: Map<string, ViolationContract>,
	): void {
		for (const violation of violations) {
			const item: TypeScriptWorkerViolation = {
				file: violation.file(),
				line: violation.line(),
				message: violation.message(),
				hint: violation.hint(),
				rule_id: violation.rule_id(),
				priority: violation.priority(),
			};
			const identity = JSON.stringify([item.file, item.line, item.message, item.hint, item.rule_id, item.priority]);
			if (root_violations.has(identity)) {
				continue;
			}
			root_violations.set(identity, new ViolationValue(item));
		}
	}

	/** Responsibilities: _worker root diagnostic restoration_. **/
	private root_violation(item: TypeScriptWorkerViolation): void {
		const identity = JSON.stringify([item.file, item.line, item.message, item.hint, item.rule_id, item.priority]);
		if (this._root_violations.has(identity)) {
			return;
		}
		this._root_violations.set(identity, new ViolationValue(item));
	}

	/** Responsibilities: _worker file diagnostic restoration_. **/
	private file_violation(item: TypeScriptWorkerViolation): void {
		let absolute_file = this._source_by_relative.get(item.file);
		if (absolute_file === undefined) {
			absolute_file = resolve(this._root, item.file);
		}
		const file_violations = this._violations_by_file.get(absolute_file);
		if (file_violations === undefined) {
			throw new Error(`TypeScript worker returned a diagnostic outside its shard: ${JSON.stringify(item)}`);
		}
		file_violations.push(new ViolationValue(item));
	}

	/** Responsibilities: _worker diagnostic restoration_. **/
	private append_worker_violations(output: TypeScriptWorkerOutput): void {
		for (const item of output.violations) {
			if (item.file.length === 0) {
				this.root_violation(item);
				continue;
			}
			this.file_violation(item);
		}
	}

	/** Responsibilities: _worker duration collection_. **/
	private append_worker_durations(output: TypeScriptWorkerOutput): void {
		for (const duration of output.timers) {
			this._stage_timer.add_duration(duration);
		}
	}

	/** Responsibilities: _worker result combination_. **/
	private append_merge_results(
		merged: Map<string, ViolationContract[]>,
		root_violations: Map<string, ViolationContract>,
		worker_results: ReadonlyMap<string, readonly ViolationContract[]>,
	): void {
		for (const [file, violations] of worker_results) {
			if (file === "") {
				this.append_root_diagnostics(violations, root_violations);
				continue;
			}
			const existing_violations = merged.get(file) ?? [];
			merged.set(file, [...existing_violations, ...violations]);
		}
	}

	/** Responsibilities: _worker diagnostic dependencies_. **/
	public constructor(execution: TypeScriptWorkerExecution) {
		const { linter_options, run_options } = execution;
		const { context, repo_root } = linter_options;
		this._root = repo_root;
		this._source_by_relative = new Map(
			context.files().map((source) => [source.relative_path, source.absolute_path] as const),
		);
		const { services } = run_options;
		const timer_values = services.timers.values();
		const timer_state = timer_values.next();
		if (timer_state.done) {
			this._stage_timer = new LintStageTimer();
		} else {
			this._stage_timer = timer_state.value;
		}
		this._violations_by_file = new Map();
		this._root_violations = new Map();
	}

	/** Responsibilities: _worker diagnostic grouping_. **/
	public collect(
		results: readonly TypeScriptWorkerFinishedResult[],
	): ReadonlyMap<string, readonly ViolationContract[]> {
		for (const { files, output } of results) {
			if (output.parsed_files !== files.length) {
				throw new Error(`TypeScript AST worker parsed ${output.parsed_files} files from a ${files.length}-file shard.`);
			}
			for (const file of files) {
				this._violations_by_file.set(file, []);
			}
			this.append_worker_durations(output);
			this.append_worker_violations(output);
		}
		this._violations_by_file.set("", [...this._root_violations.values()]);
		return this._violations_by_file;
	}

	/** Responsibilities: _diagnostic merge_. **/
	public merge(
		main_results: ReadonlyMap<string, readonly ViolationContract[]>,
		worker_results: ReadonlyMap<string, readonly ViolationContract[]>,
	): ReadonlyMap<string, readonly ViolationContract[]> {
		const main = new MainWorkerResults(main_results);
		const merged = main.files();
		const root_violations = main.root_diagnostics();
		this.append_merge_results(merged, root_violations, worker_results);
		merged.set("", [...root_violations.values()]);
		return merged;
	}
}
