import { CallableReferenceMatcher } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_reference_matcher";
import type { UsageData } from "src/linting/orchestration/runtime/composition/types";
import { MIN_USAGE_FILES } from "src/constants";
import { PLUGIN_MARKER_NAME } from "src/metrics/constants";
import type {
	CallableClassIndex,
	CallableDefinition,
	CallableDefinitionUsageInputContract,
	CallableProjectIndex,
	ParsedFile,
} from "src/metrics/types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { CallableDefinitionUsageContract, CallableReferenceMatcherContract, SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableOwnershipResolver } from "src/types";

/** Responsibilities: _callable usage aggregation_, _unused callable diagnostics_. **/
export class CallableDefinitionUsage implements CallableDefinitionUsageContract {
	private readonly definition: CallableDefinition;
	private readonly local_file: ParsedFile;
	private readonly production_files: ParsedFile[];
	private readonly production_file_names: ReadonlySet<string>;
	private readonly test_file_names: ReadonlySet<string>;
	private readonly definitions: CallableDefinition[];
	private readonly type_members: CallableProjectIndex;
	private readonly class_nodes: CallableClassIndex;
	private readonly reference_index: SourceReferenceIndexContract<string>;
	private readonly method_count: number;
	private readonly matcher: CallableReferenceMatcherContract;

	/** Responsibilities: _hook method classification_. **/
	private external_hook_method(): boolean {
		for (const decorator of this.definition.node.decorators) {
			const normalized = decorator.toLowerCase();
			if (normalized.includes("hook")) {
				return true;
			}
			if (normalized.includes(PLUGIN_MARKER_NAME) && normalized.includes("marker")) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _selection usage label analysis_. **/
	private usage_label(): string {
		let label = this.definition.node.name;
		if (this.definition.kind === "method") {
			let owner = this.definition.node.owner;
			if (owner === undefined) {
				owner = "<unknown>";
			}
			label = `${owner}.${this.definition.node.name}`;
		}
		return label;
	}

	/** Responsibilities: _creation usage violation local_. **/
	private usage_violation(used_locally: boolean, external_files: Set<string>): ViolationContract[] {
		const count = external_files.size;
		if (count >= MIN_USAGE_FILES) {
			return [];
		}
		if (used_locally) {
			return [];
		}
		if (count === 0) {
			const test_only = this.test_only_violation();
			if (test_only.length > 0) {
				return test_only;
			}
		}
		return this.insufficient_usage_violation(count);
	}

	/** Responsibilities: _insufficient callable usage reporting_. **/
	private insufficient_usage_violation(count: number): ViolationContract[] {
		const rule = new DiagnosticRule("unused-callable");
		return [
			rule.violation(this.definition.file, this.definition.node.start + 1, {
				kind: this.definition.kind,
				label: this.usage_label(),
				count: String(count),
				file_word: count === 1 ? "file" : "files",
			}),
		];
	}

	/** Responsibilities: _test-only callable reporting_. **/
	private test_only_violation(): ViolationContract[] {
		const test_files = this.matcher.external_files(this.definition.file, this.method_count, this.test_file_names);
		if (test_files.size === 0) {
			return [];
		}
		const rule = new DiagnosticRule("test-only-usage");
		return [
			rule.violation(this.definition.file, this.definition.node.start + 1, {
				kind: this.definition.kind,
				label: this.usage_label(),
			}),
		];
	}

	/** Responsibilities: _collection local external reference_. **/
	private usage(): UsageData {
		const used_locally = this.matcher.file_references(this.local_file, this.method_count);
		const external_files = this.matcher.external_files(
			this.definition.file,
			this.method_count,
			this.production_file_names,
		);
		return { used_locally, external_files };
	}

	/** Responsibilities: _initialization callable definition inputs_. **/
	public constructor(options: CallableDefinitionUsageInputContract, ownership: CallableOwnershipResolver) {
		this.definition = options.definition;
		this.local_file = options.local_file;
		this.production_files = options.production_files;
		this.production_file_names = options.production_file_names;
		this.test_file_names = options.test_file_names;
		this.definitions = options.definitions;
		this.type_members = options.type_members;
		this.class_nodes = options.class_nodes;
		this.reference_index = options.reference_index;
		this.matcher = new CallableReferenceMatcher({
			definition: this.definition,
			is_python: this.definition.file.endsWith(".py"),
			parsed_files: this.production_files,
			definitions: this.definitions,
			project_types: this.type_members,
			class_nodes: this.class_nodes,
			reference_index: this.reference_index,
			references_by_file: options.references_by_file,
			ownership,
			matcher_indexes: options.matcher_indexes,
		});
		this.method_count = options.method_count;
	}

	/** Responsibilities: _reporting callable externally usage_. **/
	public external_method(): boolean {
		if (this.definition.kind !== "method") {
			return false;
		}
		return this.external_hook_method();
	}

	/** Responsibilities: _collection unused-callable violations configuration_. **/
	public collect_violations(): ViolationContract[] {
		if (this.external_method()) {
			return [];
		}
		const usage = this.usage();
		return this.usage_violation(usage.used_locally, usage.external_files);
	}
}
