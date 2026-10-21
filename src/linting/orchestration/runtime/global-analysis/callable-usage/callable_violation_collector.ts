import { CallableDefinitionUsage } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_definition_usage";
import type { CallableDefinitionUsageContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableDefinition, ParsedFile } from "src/metrics/types";
import type { CallableUsageCollectorStateContract } from "src/linting/orchestration/runtime/composition/types";
import { TestPathSyntax } from "src/test_path_syntax";

/** Responsibilities: _callable usage resolution_, _violation collection_. **/
export class CallableViolationCollector {
	private readonly state: CallableUsageCollectorStateContract;
	private readonly files_by_name: ReadonlyMap<string, ParsedFile>;
	private readonly production_file_names: ReadonlySet<string>;
	private readonly test_file_names: ReadonlySet<string>;

	/** Responsibilities: _callable source file lookup_. **/
	private source_file(definition: CallableDefinition): ParsedFile {
		const file = this.files_by_name.get(definition.file);
		if (file === undefined) {
			throw new Error(`Missing parsed file for callable: ${definition.file}`);
		}
		return file;
	}

	/** Responsibilities: _construction usage analysis callable_. **/
	private usage_for(definition: CallableDefinition): CallableDefinitionUsageContract {
		return new CallableDefinitionUsage(
			{
				definition,
				local_file: this.source_file(definition),
				production_files: this.state.production_files,
				production_file_names: this.production_file_names,
				test_file_names: this.test_file_names,
				definitions: this.state.definitions,
				type_members: this.state.project_types,
				class_nodes: this.state.class_nodes,
				reference_index: this.state.reference_index,
				references_by_file: this.state.references_by_file,
				method_count: this.state.method_counts.count(definition.node.name),
				matcher_indexes: this.state.matcher_indexes,
			},
			this.state.ownership,
		);
	}

	/** Responsibilities: _initialization callable usage state_. **/
	constructor(state: CallableUsageCollectorStateContract) {
		this.state = state;
		this.files_by_name = state.matcher_indexes.files_by_name;
		this.production_file_names = new Set(state.production_files.map((file) => file.file));
		const test_path_syntax = new TestPathSyntax();
		this.test_file_names = new Set(
			Array.from(this.files_by_name.keys()).filter((file) => test_path_syntax.test_file(file)),
		);
	}

	/** Responsibilities: _collection unused-callable violations definition_. **/
	public collect_for(definition: CallableDefinition): ViolationContract[] {
		if (this.state.external_methods.has(definition)) {
			return [];
		}
		const usage = this.usage_for(definition);
		return usage.collect_violations();
	}

	/** Responsibilities: _collection unused-callable violations definitions_. **/
	public collect_all(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const definition of this.state.definitions) {
			violations.push(...this.collect_for(definition));
		}
		return violations;
	}
}
