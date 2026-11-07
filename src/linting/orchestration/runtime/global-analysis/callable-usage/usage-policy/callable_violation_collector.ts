import { PYTHON_LANGUAGE, TEST_PATH_SUFFIXES, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { CallableUsageCollectorState } from "src/contracts/types/composition_types";
import { CallableDefinitionUsage } from "src/linting/orchestration/runtime/global-analysis/callable-usage/usage-policy/callable_definition_usage";
import type {
	CallableDefinition,
	CallableDefinitionUsageProject,
	CallableDefinitionUsageReferences,
	CallableDefinitionUsageSubject,
	ParsedFile,
} from "src/metrics/types";
import type { ViolationContract } from "src/reporting_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _callable usage resolution_, _violation collection_. **/
export class CallableViolationCollector {
	private readonly _state: CallableUsageCollectorState;

	/** Responsibilities: _project usage indexes_. **/
	private project_usage(): CallableDefinitionUsageProject {
		return {
			production_files: this._state.production_files,
			production_file_index: this.production_file_index(),
			production_file_names: new Set(this._state.production_files.map((file) => file.file)),
			test_file_names: this.test_file_names(),
			definitions: this._state.definitions,
			type_members: this._state.project_types,
			class_nodes: this._state.class_nodes,
			matcher_indexes: this._state.matcher_indexes,
		};
	}

	/** Responsibilities: _production file lookup_. **/
	private production_file_index(): ReadonlyMap<string, ParsedFile> {
		const production_files = new Map<string, ParsedFile>();
		for (const file of this._state.production_files) {
			production_files.set(file.file, file);
		}
		return production_files;
	}

	/** Responsibilities: _test file membership_. **/
	private test_file_names(): ReadonlySet<string> {
		const test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const test_files = new Set<string>();
		const files_by_name = this._state.matcher_indexes.files_by_name;
		for (const [file, parsed_file] of files_by_name) {
			if (test_path_syntax.classify(file).has(TestPathKind.TestFile)) {
				test_files.add(parsed_file.file);
			}
		}
		return test_files;
	}

	/** Responsibilities: _reference usage indexes_. **/
	private reference_usage(): CallableDefinitionUsageReferences {
		return {
			reference_index: this._state.reference_index,
			references_by_file: this._state.references_by_file,
		};
	}

	/** Responsibilities: _callable usage violations_. **/
	private definition_subject(definition: CallableDefinition): CallableDefinitionUsageSubject {
		const files_by_name = this._state.matcher_indexes.files_by_name;
		const source_file = files_by_name.get(definition.file);
		if (source_file === undefined) {
			throw new Error(`Missing parsed file for callable: ${definition.file}`);
		}
		let language = TYPESCRIPT_LANGUAGE;
		if (definition.file.endsWith(".py")) {
			language = PYTHON_LANGUAGE;
		}
		return {
			definition,
			local_file: source_file,
			method_count: this._state.method_counts.count(definition.node.identity.name, language),
		};
	}

	/** Responsibilities: _callable usage state_. **/
	public constructor(state: CallableUsageCollectorState) {
		this._state = state;
	}

	/** Responsibilities: _single callable usage violations_. **/
	public collect_definition(
		definition: CallableDefinition,
		project_usage: CallableDefinitionUsageProject,
	): ViolationContract[] {
		if (this._state.external_methods.has(definition)) {
			return [];
		}
		const subject = this.definition_subject(definition);
		const usage = new CallableDefinitionUsage(
			{
				subject,
				project: project_usage,
				references: this.reference_usage(),
			},
			this._state.ownership,
		);
		return usage.collect_violations();
	}

	/** Responsibilities: _collection unused-callable violations definitions_. **/
	public collect_all(): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const project_usage = this.project_usage();
		for (const definition of this._state.definitions) {
			violations.push(...this.collect_definition(definition, project_usage));
		}
		return violations;
	}
}
