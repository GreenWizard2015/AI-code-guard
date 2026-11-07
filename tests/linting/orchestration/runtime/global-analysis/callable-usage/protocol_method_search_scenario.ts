import { CallableUsageReferences } from "src/linting/orchestration/runtime/global-analysis/callable-usage/indexing/callable_usage_references";
import { CallableReferenceMatcher } from "src/linting/orchestration/runtime/global-analysis/callable-usage/reference-matching/callable_reference_matcher";
import type { CallableMatcherContext, ParsedFile } from "src/metrics/types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";

/** Responsibilities: _protocol method lookup scenario_, _indexed match results_. **/
export class CallableMethodSearchScenario {
	/** Responsibilities: _test source file creation_. **/
	private source_file(file: string, source: string, imports: ReadonlySet<string>): ParsedFile {
		const ast_file = new TypeScriptAstFile(file, source);
		const ast = ast_file.normalized();
		return { file, absolute_file: `/project/${file}`, imports, ast, reference_aliases: [] };
	}

	/** Responsibilities: _targeted call reference fixture_. **/
	private targeted_file(file: string, target: string): ParsedFile {
		const source = this.source_file(file, "declare const service: RunnerContract; service.run();", new Set());
		const source_ast = source.ast;
		const source_references = source_ast.references;
		const call_references = source_references.call_references.map((reference) => ({
			...reference,
			target_file: target,
		}));
		return {
			...source,
			ast: { ...source_ast, references: { ...source_references, call_references } },
		};
	}

	/** Responsibilities: _protocol method lookup_, _production match results_. **/
	public search(unrelated_production_count: number): {
		matched_files: ReadonlySet<string>;
		indexed_candidate_files: ReadonlySet<string>;
		test_only_file: string;
	} {
		const contract_file = this.source_file(
			"contract.ts",
			"export interface RunnerContract { run(): void; }",
			new Set(),
		);
		const definition_file = this.source_file(
			"worker.ts",
			"class RunnerContract { run(): void {} }",
			new Set([contract_file.absolute_file]),
		);
		const unrelated_files: ParsedFile[] = [];
		for (let index = 0; index < unrelated_production_count; index += 1) {
			unrelated_files.push(this.source_file(`unrelated-${index}.ts`, "export {};", new Set()));
		}
		const consumer_file = this.targeted_file("consumer.ts", contract_file.file);
		const production_files = [definition_file, ...unrelated_files, contract_file, consumer_file];
		const test_only_file = this.targeted_file("consumer.test.ts", contract_file.file);
		const references = new CallableUsageReferences();
		for (const file of production_files) {
			references.append_file(file);
		}
		references.append_file(test_only_file);
		const snapshot = references.snapshot(new Set(["RunnerContract"]));
		const definition_ast = definition_file.ast;
		const source_model = definition_ast.source;
		const classes = source_model.classes;
		const class_node = classes.at(0);
		if (class_node === undefined) {
			throw new Error("Expected fixture class to be present.");
		}
		const class_structure = class_node.structure;
		const methods = class_structure.methods;
		const method_node = methods.at(0);
		if (method_node === undefined) {
			throw new Error("Expected fixture method to be present.");
		}
		const production_file_index = new Map<string, ParsedFile>();
		const production_members = new Set<string>();
		for (const file of production_files) {
			production_file_index.set(file.file, file);
			production_members.add(file.file);
		}
		const context: CallableMatcherContext = {
			callable: {
				definition: { file: definition_file.file, kind: "method", node: method_node },
				is_python: false,
			},
			source: { production_file_index },
			project: {
				definitions: [],
				project_types: new Map(),
				class_nodes: new Map(),
				matcher_indexes: {
					classes: new Map([[`${definition_file.file}::RunnerContract`, class_node]]),
					protocol_names: new Set(["RunnerContract"]),
					methods_by_owner: new Map(),
					method_owner_counts: new Map(),
					files_by_name: snapshot.files_by_name,
					contract_method_files: snapshot.contract_method_files,
					method_owner_references: snapshot.method_owner_references,
				},
			},
			references: {
				reference_index: snapshot.reference_index,
				references_by_file: snapshot.references_by_file,
				ownership: () => true,
			},
		};
		const method_candidates = snapshot.contract_method_files.get("run") ?? [];
		const indexed_candidate_files = new Set(method_candidates.map((file) => file.file));
		const matcher = new CallableReferenceMatcher(context);
		const matched_files = matcher.external_files(definition_file.file, 1, production_members);
		return { matched_files, indexed_candidate_files, test_only_file: test_only_file.file };
	}
}
