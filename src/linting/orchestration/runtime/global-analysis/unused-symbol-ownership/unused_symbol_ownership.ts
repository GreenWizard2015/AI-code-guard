import ts from "typescript";
import type { ProjectSourceScannerContract } from "src/protocols";
import type { LintSourceRecord } from "src/types";
import type {
	UnusedFieldOwner,
	UnusedParameterInterval,
	UnusedParameterIntervalCache,
	UnusedSymbolDefinition,
	UnusedSourceImportCache,
} from "src/core/types";
import { UnusedSymbolReceiver } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_receiver";
import { UnusedFieldOwnershipIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_field_ownership_index";

/** Responsibilities: _unused field owner resolution_, _shadow binding detection_. **/
export class UnusedSymbolOwnership {
	private readonly scanner: ProjectSourceScannerContract;
	private readonly available_files: Set<string>;
	private readonly import_cache: UnusedSourceImportCache;
	private readonly receiver: UnusedSymbolReceiver;
	private readonly fields: UnusedFieldOwnershipIndex;
	private readonly parameter_intervals: UnusedParameterIntervalCache;

	/** Responsibilities: _source import cache_. **/
	private source_imports(source: LintSourceRecord): ReadonlySet<string> {
		const cached = this.import_cache.get(source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this.scanner.resolved_imports(source.absolute_path, this.available_files);
		this.import_cache.set(source.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _parameter interval indexing_. **/
	private append_parameter_intervals(
		source_file: ts.SourceFile,
		node: ts.Node,
		index: Map<string, UnusedParameterInterval[]>,
	): void {
		if (ts.isFunctionLike(node)) {
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
		}
		node.forEachChild((child) => this.append_parameter_intervals(source_file, child, index));
	}

	/** Responsibilities: _parameter interval index_. **/
	private parameter_index(source_file: ts.SourceFile): Map<string, UnusedParameterInterval[]> {
		const cached = this.parameter_intervals.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, UnusedParameterInterval[]>();
		this.append_parameter_intervals(source_file, source_file, index);
		this.parameter_intervals.set(source_file, index);
		return index;
	}

	/** Responsibilities: _this receiver field ownership_. **/
	private this_field_owners(source: LintSourceRecord, node: ts.Node): readonly UnusedFieldOwner[] {
		if (!ts.isClassDeclaration(node)) {
			return [];
		}
		if (node.name === undefined) {
			return [];
		}
		return this.fields
			.owner_fields(source.absolute_path, node.name.text, this.source_imports(source))
			.filter((item) => item.file === source.relative_path);
	}

	/** Responsibilities: _property receiver ownership_. **/
	private property_owners(
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		receiver: ts.Expression,
	): readonly UnusedFieldOwner[] {
		if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
			let current: ts.Node | undefined = receiver.parent;
			while (current !== undefined) {
				const owners = this.this_field_owners(source, current);
				if (owners.length > 0) {
					return owners;
				}
				current = current.parent;
			}
			return [];
		}
		if (!this.receiver.known(source_file, receiver)) {
			return [];
		}
		const owner = this.receiver.type(source_file, receiver);
		return this.fields.owner_fields(source.absolute_path, owner, this.source_imports(source));
	}

	/** Responsibilities: _ownership resolver initialization_. **/
	public constructor(
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
		import_cache: UnusedSourceImportCache,
	) {
		this.scanner = scanner;
		this.available_files = available_files;
		this.import_cache = import_cache;
		this.receiver = new UnusedSymbolReceiver();
		this.fields = new UnusedFieldOwnershipIndex(definitions_by_file);
		this.parameter_intervals = new WeakMap<ts.SourceFile, Map<string, UnusedParameterInterval[]>>();
	}

	/** Responsibilities: _parameter shadow result_. **/
	public parameter_shadow(source: LintSourceRecord, name: string, line: number): boolean {
		if (!source.typescript()) {
			return false;
		}
		const intervals = this.parameter_index(source.typescript_ast.source_file_node()).get(name);
		if (intervals === undefined) {
			return false;
		}
		for (const interval of intervals) {
			if (line >= interval.start && line <= interval.end) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _property field ownership_. **/
	public property_usage_owners(
		source: LintSourceRecord,
		source_file: ts.SourceFile,
		receiver: ts.Expression,
		name: string,
	): readonly UnusedFieldOwner[] {
		const owned = this.property_owners(source, source_file, receiver);
		if (owned.length > 0) {
			return owned;
		}
		return this.fields.fields_named(name);
	}

	/** Responsibilities: _contract field ownership_. **/
	public contract_fields(definition: UnusedSymbolDefinition): readonly UnusedFieldOwner[] {
		if (definition.owner_kind !== "class") {
			return [];
		}
		return this.fields.fields_named(definition.name);
	}
}
