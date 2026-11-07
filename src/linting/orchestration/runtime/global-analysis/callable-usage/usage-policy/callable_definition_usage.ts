import { MIN_USAGE_FILES } from "src/constants";
import type { UsageData } from "src/contracts/types/composition_types";
import { CallableReferenceMatcher } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/callable_reference_matcher";
import type {
	CallableClassIndex,
	CallableDefinition,
	CallableDefinitionUsageInput,
	CallableProjectIndex,
	ParsedFile,
} from "src/metrics/types";
import type { AstCallableNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	CallableDefinitionUsageContract,
	CallableReferenceMatcherContract,
	SourceReferenceIndexContract,
} from "src/shared_services_protocols";
import type { CallableOwnershipResolver } from "src/types";

/** Responsibilities: _callable usage aggregation_, _unused callable diagnostics_. **/
export class CallableDefinitionUsage implements CallableDefinitionUsageContract {
	private readonly _definition: CallableDefinition;
	private readonly _callable_node: AstCallableNode;
	private readonly _local_file: ParsedFile;
	private readonly _production_file_names: ReadonlySet<string>;
	private readonly _test_file_names: ReadonlySet<string>;
	private readonly _definitions: CallableDefinition[];
	private readonly _type_members: CallableProjectIndex;
	private readonly _class_nodes: CallableClassIndex;
	private readonly _reference_index: SourceReferenceIndexContract<string>;
	private readonly _method_count: number;
	private readonly _matcher: CallableReferenceMatcherContract;

	/** Responsibilities: _selection usage label analysis_. **/
	private usage_label(): string {
		let label = this._callable_node.identity.name;
		if (this._definition.kind === "method") {
			label = `${this._callable_node.identity.owner}.${this._callable_node.identity.name}`;
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
			rule.violation(this._definition.file, this._callable_node.identity.start + 1, {
				kind: this._definition.kind,
				label: this.usage_label(),
				count: String(count),
				file_word: count === 1 ? "file" : "files",
			}),
		];
	}

	/** Responsibilities: _test-only callable reporting_. **/
	private test_only_violation(): ViolationContract[] {
		const test_files = this._matcher.external_files(this._definition.file, this._method_count, this._test_file_names);
		if (test_files.size === 0) {
			return [];
		}
		const rule = new DiagnosticRule("test-only-usage");
		return [
			rule.violation(this._definition.file, this._callable_node.identity.start + 1, {
				kind: this._definition.kind,
				label: this.usage_label(),
			}),
		];
	}

	/** Responsibilities: _collection local external reference_. **/
	private usage(): UsageData {
		const used_locally = this._matcher.file_references(this._local_file, this._method_count);
		const external_files = this._matcher.external_files(
			this._definition.file,
			this._method_count,
			this._production_file_names,
		);
		return { used_locally, external_files };
	}

	/** Responsibilities: _initialization callable definition inputs_. **/
	public constructor(options: CallableDefinitionUsageInput, ownership: CallableOwnershipResolver) {
		this._definition = options.subject.definition;
		this._callable_node = options.subject.definition.node;
		this._local_file = options.subject.local_file;
		this._method_count = options.subject.method_count;
		this._production_file_names = options.project.production_file_names;
		this._test_file_names = options.project.test_file_names;
		this._definitions = options.project.definitions;
		this._type_members = options.project.type_members;
		this._class_nodes = options.project.class_nodes;
		this._reference_index = options.references.reference_index;
		this._matcher = new CallableReferenceMatcher({
			callable: {
				definition: this._definition,
				is_python: this._definition.file.endsWith(".py"),
			},
			source: { production_file_index: options.project.production_file_index },
			project: {
				definitions: this._definitions,
				project_types: this._type_members,
				class_nodes: this._class_nodes,
				matcher_indexes: options.project.matcher_indexes,
			},
			references: {
				reference_index: this._reference_index,
				references_by_file: options.references.references_by_file,
				ownership,
			},
		});
	}

	/** Responsibilities: _collection unused-callable violations configuration_. **/
	public collect_violations(): ViolationContract[] {
		const usage = this.usage();
		return this.usage_violation(usage.used_locally, usage.external_files);
	}
}
