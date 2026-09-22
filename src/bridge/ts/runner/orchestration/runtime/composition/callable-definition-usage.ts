import { CallableOwnership } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-ownership';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import { MIN_USAGE_FILES } from 'src/constants';
import { CallableReferenceMatcher } from 'src/bridge/ts/runner/orchestration/runtime/composition/callable-reference-matcher';
import type { CallableDefinition, CallableDefinitionUsageOptions, CallableClassIndex, CallableProjectIndex, ParsedFile } from 'src/metrics/types';
import type { CallableReferenceIndex } from 'src/metrics/callable-reference-index';
import type { UsageData } from 'src/bridge/ts/runner/orchestration/runtime/composition/types';
import type { CallableOwnershipResolver } from 'src/types';

/** Responsibilities: _detection local external usage_. **/
export class CallableDefinitionUsage {
	private readonly callable_ownership = new CallableOwnership();
	private readonly definition: CallableDefinition;
	private readonly parsed_files: ParsedFile[];
	private readonly production_files: ParsedFile[];
	private readonly definitions: CallableDefinition[];
	private readonly type_members: CallableProjectIndex;
	private readonly class_nodes: CallableClassIndex;
	private readonly reference_index: CallableReferenceIndex;
	private readonly method_count: number;
	private readonly matcher: CallableReferenceMatcher;

	/** Responsibilities: _selection usage label analysis_. **/
	private usage_label(): string {
		let label = this.definition.node.name;
		if (this.definition.kind === 'method') {
			let owner = this.definition.node.owner;
			if (owner === undefined) {
				owner = '<unknown>';
			}
			label = `${owner}.${this.definition.node.name}`;
		}
		return label;
	}

	/** Responsibilities: _creation usage violation local_. **/
	private usage_violation(used_locally: boolean, external_files: Set<string>): Violation[] {
		const count = external_files.size;
		if (count >= MIN_USAGE_FILES || (count === 0 && used_locally)) {
			return [];
		}
		const rule = new DiagnosticRule('unused-callable');
		return [
			rule.violation(this.definition.file, this.definition.node.start + 1, {
				kind: this.definition.kind,
				label: this.usage_label(),
				count: String(count),
				file_word: count === 1 ? 'file' : 'files',
			}),
		];
	}

	/** Responsibilities: _collection local external reference_. **/
	private usage(): UsageData {
		const local_files = this.parsed_files.filter(file => file.file === this.definition.file);
		if (local_files.length === 0) {
			return { used_locally: false, external_files: new Set() };
		}
		const local_file = local_files[0];
		const used_locally = this.matcher.file_references(local_file, this.method_count);
		const external_files = this.matcher.external_files(
			this.definition.file,
			this.method_count
		);
		return { used_locally, external_files };
	}

	/** Responsibilities: _initialization callable definition inputs_. **/
	public constructor(options: CallableDefinitionUsageOptions, ownership: CallableOwnershipResolver) {
		this.definition = options.definition;
		this.parsed_files = options.parsed_files;
		this.production_files = options.production_files;
		this.definitions = options.definitions;
		this.type_members = options.type_members;
		this.class_nodes = options.class_nodes;
		this.reference_index = options.reference_index;
		this.matcher = new CallableReferenceMatcher({
			definition: this.definition,
			parsed_files: this.production_files,
			definitions: this.definitions,
			project_types: this.type_members,
			class_nodes: this.class_nodes,
			reference_index: this.reference_index,
			ownership,
		});
		this.method_count = options.method_count;
	}

	/** Responsibilities: _reporting callable externally usage_. **/
	public external_method(): boolean {
		if (this.definition.kind !== 'method') {
			return false;
		}
		return this.callable_ownership.external_method(this.definition, this.production_files);
	}

	/** Responsibilities: _collection unused-callable violations configuration_. **/
	public collect_violations(): Violation[] {
		if (this.external_method()) {
			return [];
		}
		const usage = this.usage();
		return this.usage_violation(usage.used_locally, usage.external_files);
	}
}
