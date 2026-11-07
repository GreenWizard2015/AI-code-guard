import { RULE_IDS } from "src/linting/constants";
import { PythonCollaboratorFileAnalysis } from "src/linting/orchestration/runtime/python/python_collaborator_file_analysis";
import type {
	PythonCollaboratorFileContextContract,
	PythonCollaboratorImport,
	PythonCollaboratorMethod,
	PythonCollaboratorMethodAnalysisOptions,
	PythonCollaboratorScannerOptions,
	PythonCollaboratorUseOptions,
	PythonCompositionImportsContract,
	PythonMethodMap,
} from "src/linting/orchestration/runtime/python/python_collaborator_types";
import { PythonCollaboratorUse } from "src/linting/orchestration/runtime/python/python_collaborator_use";
import { PYTHON_CONSTRUCTOR_NAME, PYTHON_POST_INIT_METHOD } from "src/metrics/constants";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ImportedSymbol } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathKind } from "src/types";
import type { PythonLintInput } from "src/types";

/** Responsibilities: _cross-file Python contract lookup_, _per-operation collaborator diagnostics_. **/
export class PythonCollaboratorScanner {
	private readonly _source_asts: ReadonlyMap<string, NormalizedAstFile>;
	private readonly _import_resolver: PythonCompositionImportsContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _implementations: Map<string, PythonMethodMap>;

	/** Responsibilities: _protocol method indexing_. **/
	private protocol_members(file: string, name: string): ReadonlySet<string> {
		const source = this._source_asts.get(file);
		if (source === undefined) {
			return new Set();
		}
		for (const class_node of source.source.classes) {
			if (class_node.identity.name === name && class_node.classification.protocol) {
				return new Set(class_node.structure.methods.map((method) => method.identity.name));
			}
		}
		return new Set();
	}

	/** Responsibilities: _complete contract implementation matching_. **/
	private all_members_implemented(members: ReadonlySet<string>, class_node: AstClassNode): boolean {
		if (members.size === 0) {
			return false;
		}
		for (const name of members) {
			const method_exists = class_node.structure.methods.some((method) => method.identity.name === name);
			if (!method_exists) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _base contract resolution_. **/
	private class_contracts(
		file: string,
		class_node: AstClassNode,
		imports: ReadonlyMap<string, ImportedSymbol>,
	): PythonMethodMap {
		const contracts = new Map<string, ReadonlySet<string>>();
		for (const base_name of class_node.structure.base_class_names) {
			let contract_file = file;
			let contract_name = base_name;
			const imported = imports.get(base_name);
			if (imported !== undefined) {
				contract_file = imported.file;
				contract_name = imported.name;
			}
			const members = this.protocol_members(contract_file, contract_name);
			if (this.all_members_implemented(members, class_node)) {
				contracts.set(`${contract_file}\u0000${contract_name}`, members);
			}
		}
		return contracts;
	}

	/** Responsibilities: _implementation contract registration_. **/
	private append_implementation(source_file: string, source: NormalizedAstFile): void {
		if (this._test_path_syntax.classify(source_file).has(TestPathKind.TestFile)) {
			return;
		}
		const imports = this._import_resolver.python_imports(source_file, source.source.python_imports);
		for (const class_node of source.source.classes) {
			if (class_node.classification.protocol || class_node.classification.type_contract) {
				continue;
			}
			const contracts = this.class_contracts(source_file, class_node, imports);
			if (contracts.size === 0) {
				continue;
			}
			this._implementations.set(`${source_file}\u0000${class_node.identity.name}`, contracts);
		}
	}

	/** Responsibilities: _local symbol collision_. **/
	private local_name_shadowed(
		method: PythonCollaboratorMethod,
		local_name: string,
		module_variables: ReadonlySet<string>,
	): boolean {
		if (module_variables.has(local_name)) {
			return true;
		}
		if (method.signature.typed_arguments.some((argument) => argument.name === local_name)) {
			return true;
		}
		return method.signature.untyped_parameters.includes(local_name);
	}

	/** Responsibilities: _construction lifecycle filtering_. **/
	private constructor_method(method_name: string): boolean {
		if (method_name === PYTHON_CONSTRUCTOR_NAME) {
			return true;
		}
		return method_name === PYTHON_POST_INIT_METHOD;
	}

	/** Responsibilities: _collaborator usage inputs_. **/
	private usage_options(options: PythonCollaboratorMethodAnalysisOptions): PythonCollaboratorUseOptions {
		const { file_context, method, class_node, collaborator_name, local_name, contracts } = options;
		return {
			start: method.identity.start,
			end: method.identity.end,
			statements: method.signature.statements,
			owner: class_node.identity.name,
			class_name: collaborator_name,
			local_name,
			contracts,
			references: file_context.call_references(),
			imports: file_context.imports(),
		};
	}

	/** Responsibilities: _per-method collaborator diagnostics_. **/
	private append_method_violation(options: PythonCollaboratorMethodAnalysisOptions): void {
		const { file_context, method, local_name } = options;
		if (this.constructor_method(method.identity.name)) {
			return;
		}
		if (this.local_name_shadowed(method, local_name, file_context.module_variables())) {
			return;
		}
		const use = new PythonCollaboratorUse(this.usage_options(options));
		const line = use.violation_line();
		if (line < 0 || file_context.reported_lines().has(line)) {
			return;
		}
		file_context.reported_lines().add(line);
		const rule = new DiagnosticRule(RULE_IDS.concrete_collaborator_created_per_operation);
		file_context.violations().push(rule.violation(file_context.input().source_file, line + 1, {}));
	}

	/** Responsibilities: _imported collaborator diagnostics_. **/
	private append_imported_target(
		file_context: PythonCollaboratorFileContextContract,
		local_name: string,
		target: PythonCollaboratorImport,
	): void {
		const identity = `${target.file}\u0000${target.name}`;
		const contracts = this._implementations.get(identity);
		if (contracts === undefined) {
			return;
		}
		for (const class_node of file_context.classes()) {
			for (const method of class_node.structure.methods) {
				this.append_method_violation({
					file_context,
					method,
					class_node,
					collaborator_name: target.name,
					local_name,
					contracts,
				});
			}
		}
	}

	/** Responsibilities: _scanner state initialization_. **/
	public constructor(options: PythonCollaboratorScannerOptions) {
		this._source_asts = options.source_asts;
		this._import_resolver = options.import_resolver;
		this._test_path_syntax = options.test_path_syntax;
		this._implementations = new Map();
	}

	/** Responsibilities: _project contract indexing_. **/
	public prepare(): void {
		this._implementations.clear();
		for (const [source_file, source] of this._source_asts) {
			this.append_implementation(source_file, source);
		}
	}

	/** Responsibilities: _per-file diagnostic collection_. **/
	public violations(input: PythonLintInput): ViolationContract[] {
		if (this._test_path_syntax.classify(input.source_file).has(TestPathKind.TestFile)) {
			return [];
		}
		const imports = this._import_resolver.python_imports(input.source_file, input.normalized_ast.source.python_imports);
		const file_context = new PythonCollaboratorFileAnalysis(input, imports);
		file_context.prepare();
		for (const [local_name, target] of file_context.imports()) {
			this.append_imported_target(file_context, local_name, target);
		}
		return file_context.violations();
	}
}
