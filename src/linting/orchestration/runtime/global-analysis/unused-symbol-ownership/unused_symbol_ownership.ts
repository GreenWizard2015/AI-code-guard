import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import type { UnusedSymbolPropertyOwnershipContract } from "src/contracts/protocols/global_analysis_protocols";
import type {
	UnusedFieldOwner,
	UnusedParameterInterval,
	UnusedParameterIntervalCache,
	UnusedSourceImportCache,
	UnusedSymbolDefinition,
} from "src/core/types";
import { UnusedFieldOwnershipIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_field_ownership_index";
import { UnusedSymbolReceiver } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_receiver";
import { UnusedSymbolSourceOwnership } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_source_ownership";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _unused field owner resolution_, _shadow binding detection_. **/
export class UnusedSymbolOwnership implements UnusedSymbolPropertyOwnershipContract {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _import_cache: UnusedSourceImportCache;
	private readonly _receiver: UnusedSymbolReceiver;
	private readonly _fields: UnusedFieldOwnershipIndex;
	private readonly _parameter_intervals: UnusedParameterIntervalCache;

	/** Responsibilities: _source import cache_. **/
	/** Responsibilities: _parameter interval indexing_. **/
	private append_parameter_intervals(
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
		index: Map<string, UnusedParameterInterval[]>,
	): void {
		traversal.visit((traversal_node) => {
			const node = traversal_node.node;
			if (!ts.isFunctionLike(node)) {
				return;
			}
			const interval: UnusedParameterInterval = {
				start: source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1,
				end: source_file.getLineAndCharacterOfPosition(node.end).line + 1,
			};
			for (const parameter of node.parameters) {
				if (!ts.isIdentifier(parameter.name)) {
					continue;
				}
				let intervals = index.get(parameter.name.text);
				if (intervals === undefined) {
					intervals = [];
					index.set(parameter.name.text, intervals);
				}
				intervals.push(interval);
			}
		});
	}

	/** Responsibilities: _parameter interval coalescing_. **/
	private merge_parameter_intervals(index: Map<string, UnusedParameterInterval[]>): void {
		for (const [name, intervals] of index) {
			intervals.sort((first, second) => first.start - second.start || first.end - second.end);
			const merged: UnusedParameterInterval[] = [];
			for (const interval of intervals) {
				const previous = merged.at(-1);
				if (previous === undefined || interval.start > previous.end + 1) {
					merged.push({ ...interval });
					continue;
				}
				merged.pop();
				merged.push({ start: previous.start, end: Math.max(previous.end, interval.end) });
			}
			index.set(name, merged);
		}
	}

	/** Responsibilities: _parameter interval index_. **/
	private parameter_index(
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
	): Map<string, UnusedParameterInterval[]> {
		const cached = this._parameter_intervals.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, UnusedParameterInterval[]>();
		this.append_parameter_intervals(source_file, traversal, index);
		this.merge_parameter_intervals(index);
		this._parameter_intervals.set(source_file, index);
		return index;
	}

	/** Responsibilities: _bounded parameter interval search_. **/
	private search_parameter_interval(
		intervals: readonly UnusedParameterInterval[],
		target_line: number,
		low: number,
		high: number,
	): boolean {
		if (low > high) {
			return false;
		}
		const middle = Math.floor((low + high) / 2);
		const interval = intervals[middle];
		if (interval === undefined) {
			return false;
		}
		if (target_line < interval.start) {
			return this.search_parameter_interval(intervals, target_line, low, middle - 1);
		}
		if (target_line > interval.end) {
			return this.search_parameter_interval(intervals, target_line, middle + 1, high);
		}
		return true;
	}

	/** Responsibilities: _ownership resolver initialization_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
		import_cache: UnusedSourceImportCache,
	) {
		this._scanner = scanner;
		this._available_files = available_files;
		this._import_cache = import_cache;
		this._receiver = new UnusedSymbolReceiver();
		this._fields = new UnusedFieldOwnershipIndex(definitions_by_file);
		this._parameter_intervals = new WeakMap<ts.SourceFile, Map<string, UnusedParameterInterval[]>>();
	}

	/** Responsibilities: _parameter shadow result_. **/
	public parameter_shadow(source: LintSourceRecordData, name: string, source_line: number): boolean {
		if (source.language !== TYPESCRIPT_CACHE_OWNER) {
			return false;
		}
		const intervals = this.parameter_index(source.typescript_ast.source_file_node(), source.traversal).get(name);
		return intervals !== undefined && this.search_parameter_interval(intervals, source_line, 0, intervals.length - 1);
	}

	/** Responsibilities: _property field ownership_. **/
	public property_usage_owners(
		source: LintSourceRecordData,
		receiver: ts.Expression,
		name: string,
	): readonly UnusedFieldOwner[] {
		const source_ownership = new UnusedSymbolSourceOwnership({
			source,
			scanner: this._scanner,
			available_files: this._available_files,
			import_cache: this._import_cache,
			receiver: this._receiver,
			fields: this._fields,
		});
		const owned = source_ownership.property_owners(receiver);
		if (owned.length > 0) {
			return owned;
		}
		return this._fields.fields_named(name);
	}

	/** Responsibilities: _contract field ownership_. **/
	public contract_fields(definition: UnusedSymbolDefinition): readonly UnusedFieldOwner[] {
		if (definition.owner_kind !== "class") {
			return [];
		}
		return this._fields.fields_named(definition.name);
	}
}
